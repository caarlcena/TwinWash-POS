import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { db } from "./firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";

export default function App() {
  const [orders, setOrders] = useState([]);
  const [customerName, setCustomerName] = useState("");

  const [wash, setWash] = useState(0);
  const [dry, setDry] = useState(0);
  const [detergent, setDetergent] = useState(0);
  const [downy, setDowny] = useState(0);
  const [zonrox, setZonrox] = useState(0);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [selectedOrder, setSelectedOrder] = useState(null);

  const prices = {
    wash: 70,
    dry: 70,
    detergent: 18,
    downy: 8,
    zonrox: 6,
  };

  const calculateTotal = () =>
    wash * prices.wash +
    dry * prices.dry +
    detergent * prices.detergent +
    downy * prices.downy +
    zonrox * prices.zonrox;

  const fetchOrders = useCallback(async (date) => {
    const snapshot = await getDocs(collection(db, "orders", date, "items"));
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    setOrders(data);
  }, []);

  useEffect(() => {
    fetchOrders(selectedDate);
  }, [selectedDate, fetchOrders]);

  const addOrder = async () => {
    const newOrder = {
      customerName,
      wash,
      dry,
      detergent,
      downy,
      zonrox,
      total: calculateTotal(),
      paymentStatus: "Unpaid",
      claimStatus: "Unclaimed",
      createdAt: new Date(),
    };

    await addDoc(collection(db, "orders", selectedDate, "items"), newOrder);

    fetchOrders(selectedDate);

    setCustomerName("");
    setWash(0);
    setDry(0);
    setDetergent(0);
    setDowny(0);
    setZonrox(0);
  };

  const markPaid = async (id) => {
    await updateDoc(doc(db, "orders", selectedDate, "items", id), {
      paymentStatus: "Paid",
    });
    fetchOrders(selectedDate);
  };

  const markClaimed = async (id) => {
    await updateDoc(doc(db, "orders", selectedDate, "items", id), {
      claimStatus: "Claimed",
    });
    fetchOrders(selectedDate);
  };

  const deleteOrder = async (id) => {
    if (!window.confirm("Delete this order?")) return;

    await deleteDoc(doc(db, "orders", selectedDate, "items", id));
    fetchOrders(selectedDate);
  };

  const downloadReceiptPDF = async () => {
    if (!selectedOrder) {
      alert("Please select an order first");
      return;
    }

    const receipt = document.getElementById("receipt");
    receipt.style.display = "block";

    const canvas = await html2canvas(receipt, { scale: 3 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);

    pdf.save(`Receipt_${selectedOrder.customerName}_${selectedDate}.pdf`);

    receipt.style.display = "none";
  };

  const totalPaid = orders
    .filter((o) => o.paymentStatus === "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const totalUnpaid = orders
    .filter((o) => o.paymentStatus !== "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  return (
    <div style={{ padding: 20 }}>
      <h2>🧺 TwinWash Laundry POS</h2>

      <h3>📅 Select Date</h3>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
      />

      <h3>
        💰 Paid: ₱{totalPaid} | Unpaid: ₱{totalUnpaid}
      </h3>

      <hr />

      <input
        placeholder="Customer Name"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
      />

      {[
        ["Wash", wash, setWash],
        ["Dry", dry, setDry],
        ["Detergent", detergent, setDetergent],
        ["Downy", downy, setDowny],
        ["Zonrox", zonrox, setZonrox],
      ].map(([label, value, setter]) => (
        <div key={label}>
          {label}:
          <button onClick={() => setter(value - 1)} disabled={value === 0}>
            -
          </button>
          <span style={{ margin: 10 }}>{value}</span>
          <button onClick={() => setter(value + 1)}>+</button>
        </div>
      ))}

      <h4>Total: ₱{calculateTotal()}</h4>

      <button onClick={addOrder}>➕ Add Order</button>

      <hr />

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Name</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Claimed</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.customerName}</td>
              <td>₱{o.total}</td>
              <td>{o.paymentStatus}</td>
              <td>{o.claimStatus}</td>
              <td>
                <button onClick={() => markPaid(o.id)}>💰 Paid</button>
                <button onClick={() => markClaimed(o.id)}>📦 Claimed</button>
                <button onClick={() => deleteOrder(o.id)}>🗑️ Delete</button>

                <button
                  onClick={() => {
                    setSelectedOrder(o);
                    setTimeout(downloadReceiptPDF, 200);
                  }}
                >
                  🧾 Print Receipt
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* RECEIPT */}
      <div
        id="receipt"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "420px",
          background: "#fff",
          padding: 15,
          fontSize: 11,
        }}
      >
        <h3>TwinWash Laundry Receipt</h3>

        <p>
          Name: {selectedOrder?.customerName}
          <br />
          Date: {selectedDate}
        </p>

        <table border="1" width="100%">
          <tbody>
            <tr>
              <td>Wash</td>
              <td>{selectedOrder?.wash}</td>
              <td>₱70</td>
              <td>{(selectedOrder?.wash || 0) * 70}</td>
            </tr>

            <tr>
              <td>Dry</td>
              <td>{selectedOrder?.dry}</td>
              <td>₱70</td>
              <td>{(selectedOrder?.dry || 0) * 70}</td>
            </tr>

            <tr>
              <td>Detergent</td>
              <td>{selectedOrder?.detergent}</td>
              <td>₱18</td>
              <td>{(selectedOrder?.detergent || 0) * 18}</td>
            </tr>

            <tr>
              <td>Downy</td>
              <td>{selectedOrder?.downy}</td>
              <td>₱8</td>
              <td>{(selectedOrder?.downy || 0) * 8}</td>
            </tr>

            <tr>
              <td>Zonrox</td>
              <td>{selectedOrder?.zonrox}</td>
              <td>₱6</td>
              <td>{(selectedOrder?.zonrox || 0) * 6}</td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ textAlign: "right" }}>
          GRAND TOTAL: ₱{selectedOrder?.total}
        </h3>
      </div>
    </div>
  );
}

{
  /* //Receipt pdf form 2  */
}

{
  /* <div
        id="receipt"
        style={{
          width: "420px",
          padding: "20px",
          fontFamily: "Arial",
          background: "white",
          color: "black",
          display: "none", // will be shown only during PDF generation
        }}
      >
        <h2 style={{ textAlign: "center", margin: 0 }}>
          Twin Wash Laundry Services
        </h2>
        <p style={{ textAlign: "center", margin: 0 }}>
          Mahayahay, Bankal Lapu-Lapu City
          <br />
          Mobile #: 09162579554
          <br />
          FB Page: TwinWash Laundry Services
        </p>
        <h3 style={{ textAlign: "center", marginTop: 20 }}>
          ACKNOWLEDGEMENT RECEIPT
        </h3>
        <p>
          <b>Name:</b> {customerName}
        </p>
        <p>
          <b>Date:</b> {selectedDate}
        </p>
        <table
          width="100%"
          border="1"
          cellPadding="5"
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr style={{ background: "#efefef" }}>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {wash > 0 && (
              <tr>
                <td>WASH</td>
                <td>{wash}</td>
                <td>70</td>
                <td>{wash * 70}</td>
              </tr>
            )}
            {dry > 0 && (
              <tr>
                <td>DRY</td>
                <td>{dry}</td>
                <td>70</td>
                <td>{dry * 70}</td>
              </tr>
            )}
            {detergent > 0 && (
              <tr>
                <td>DETERGENT</td>
                <td>{detergent}</td>
                <td>18</td>
                <td>{detergent * 18}</td>
              </tr>
            )}
            {downy > 0 && (
              <tr>
                <td>DOWNY</td>
                <td>{downy}</td>
                <td>8</td>
                <td>{downy * 8}</td>
              </tr>
            )}
            {zonrox > 0 && (
              <tr>
                <td>ZONROX</td>
                <td>{zonrox}</td>
                <td>8</td>
                <td>{zonrox * 8}</td>
              </tr>
            )}
          </tbody>
        </table>
        <h3 style={{ textAlign: "right" }}>GRAND TOTAL: ₱{calculateTotal()}</h3>
        <hr style={{ marginTop: 30 }} />
        <h4>Terms and Conditions</h4>
        <p style={{ fontSize: "12px" }}>
          The management is not responsible for loose items left in pockets,
          shrinkage, damages, and discoloration. Unclaimed clothes after 30 days
          are subject to a 20% storage fee.
        </p>
      </div> */
}
