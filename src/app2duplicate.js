import React, { useState, useEffect, useCallback } from "react";
import logo from "./assets/twinwash-laundry.jpg";
import * as XLSX from "xlsx";
import { db } from "./firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "./tablet.css";
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const prices = {
    wash: 70,
    dry: 70,
    detergent: 18,
    downy: 8,
    zonrox: 6,
  };

  const calculateTotal = () => {
    return (
      wash * prices.wash +
      dry * prices.dry +
      detergent * prices.detergent +
      downy * prices.downy +
      zonrox * prices.zonrox
    );
  };
  const deleteOrder = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this order?",
    );

    if (!confirmDelete) return;

    await deleteDoc(doc(db, "orders", selectedDate, "items", id));

    fetchOrders(selectedDate);
  };

  // 📥 FETCH ORDERS PER DATE
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

  // ➕ ADD ORDER
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

  // 💰 PAID
  const markPaid = async (id) => {
    await updateDoc(doc(db, "orders", selectedDate, "items", id), {
      paymentStatus: "Paid",
    });

    fetchOrders(selectedDate);
  };

  // 📦 CLAIMED
  const markClaimed = async (id) => {
    await updateDoc(doc(db, "orders", selectedDate, "items", id), {
      claimStatus: "Claimed",
    });

    fetchOrders(selectedDate);
  };

  // 📊 DAILY TOTAL
  const dailyTotal = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  // 📉 YESTERDAY
  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };
  // Daily Total Paid
  const totalPaid = orders
    .filter((o) => o.paymentStatus === "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  //Daily Total Unpaid
  const totalUnpaid = orders
    .filter((o) => o.paymentStatus !== "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  // Total Claimed
  const totalClaimed = orders
    .filter((o) => o.claimStatus === "Claimed")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Total Unclaimed
  const totalUnclaimed = orders
    .filter((o) => o.claimStatus !== "Claimed")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  // 🧾 CLOSE DAY REPORT
  const closeDayReport = () => {
    alert(
      `🧾 DAILY REPORT\n\n` +
        `📅 Date: ${selectedDate}\n` +
        `📦 Orders: ${orders.length}\n\n` +
        `💰 Total Paid: ₱${totalPaid}\n` +
        `⏳ Total Unpaid: ₱${totalUnpaid}\n` +
        `📦 Total Claimed: ₱${totalClaimed}\n` +
        `🕒 Total Unclaimed: ₱${totalUnclaimed}`,
    );
  };

  // const downloadDailyReportPDF = async () => {
  //   const pdf = new jsPDF();

  //   pdf.text("TwinWash Daily Report", 10, 10);
  //   pdf.text(`Date: ${selectedDate}`, 10, 20);
  //   pdf.text(`Total Orders: ${orders.length}`, 10, 30);
  //   pdf.text(`Total Income: ₱${Number(dailyTotal)}`, 10, 40);

  //   let y = 60;

  //   orders.forEach((o, i) => {
  //     const cleanTotal = Number(o.total); // ✅ ensures no + or -

  //     pdf.text(
  //       `${i + 1}. ${o.customerName} - ₱${cleanTotal} - ${o.paymentStatus}`,
  //       10,
  //       y,
  //     );
  //     y += 10;
  //   });

  //   pdf.save(`Daily_Report_${selectedDate}.pdf`);
  // };

  const downloadExcelReport = () => {
    const exportData = orders.map((o) => ({
      Date: selectedDate,
      Customer: o.customerName,
      Wash: o.wash,
      Dry: o.dry,
      Detergent: o.detergent,
      Downy: o.downy,
      Zonrox: o.zonrox,
      Total: o.total,
      Payment: o.paymentStatus,
      Claim: o.claimStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");

    XLSX.writeFile(workbook, `Laundry_Report_${selectedDate}.xlsx`);
  };

  const printReceipt = () => {
    const receipt = document.getElementById("receipt");

    // show receipt temporarily
    receipt.style.display = "block";

    window.print();

    // hide again after print dialog opens
    setTimeout(() => {
      receipt.style.display = "none";
    }, 500);
  };

  return (
    <div className="app-container">
      <div className="pos-header">
        <img src={logo} alt="TwinWash Logo" className="logo" />
        <h2>TwinWash Laundry POS</h2>
      </div>

      {/* DATE SELECTOR */}
      <div className="card date-bar">
        <h3>📅 Select Date</h3>

        <input
          type="date"
          className="input-large"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <div className="date-buttons">
          <button onClick={() => setSelectedDate(getYesterday())}>
            📉 Yesterday
          </button>

          <button onClick={closeDayReport}>🧾 Close Day Report</button>
        </div>
      </div>

      <h3>📊 Total Income: ₱{dailyTotal}</h3>

      {/* COUNTERS */}
      {/* MAIN LAYOUT */}
      <div className="main-layout">
        {/* ================= LEFT PANEL ================= */}
        <div className="left-panel card">
          {/* FORM */}
          {/* CUSTOMER INPUT */}
          <input
            placeholder="Customer Name"
            className="input-large customer-input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          {/* COUNTERS */}
          {[
            ["Wash", wash, setWash],
            ["Dry", dry, setDry],
            ["Liquid Detergent", detergent, setDetergent],
            ["Downy", downy, setDowny],
            ["Zonrox ", zonrox, setZonrox],
          ].map(([label, value, setter]) => (
            <div className="counter-row" key={label}>
              <span className="counter-label">{label}</span>

              <div className="counter-controls">
                <button
                  className="btn-small"
                  onClick={() => setter(value - 1)}
                  disabled={value === 0}
                >
                  -
                </button>

                <span className="counter-value">{value}</span>

                <button className="btn-small" onClick={() => setter(value + 1)}>
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="total-row">
            <div className="total-circle">
              <span className="total-label">TOTAL</span>
              <span className="total-amount">₱{calculateTotal()}</span>
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn-primary" onClick={addOrder}>
              Add Order
            </button>

            <button className="btn-success" onClick={downloadExcelReport}>
              📥 Download Excel Report
            </button>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="pos-right">
          <div className="search-bar">
            <input
              type="text"
              placeholder="🔍 Search customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="table-container">
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
                {orders
                  .filter((o) =>
                    o.customerName
                      ?.toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                  )
                  .map((o) => (
                    <tr key={o.id}>
                      <td>{o.customerName}</td>
                      <td>₱{o.total}</td>
                      <td>{o.paymentStatus}</td>
                      <td>{o.claimStatus}</td>
                      <td>
                        <div className="table-action-buttons">
                          <button onClick={() => markPaid(o.id)}>
                            💰 Paid
                          </button>
                          <button onClick={() => markClaimed(o.id)}>
                            📦 Claimed
                          </button>
                          <button onClick={() => deleteOrder(o.id)}>
                            🗑️ Delete
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrder(o);
                              setTimeout(() => {
                                printReceipt();
                              }, 300);
                            }}
                          >
                            🧾 Print Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* // Receipt */}
      <div
        id="receipt"
        className="receipt"
        // style={{
        //   position: "absolute",
        //   left: "-9999px",
        //   width: "420px", // 🔥 HALF A4 WIDTH
        //   background: "#fff",
        //   padding: "15px",
        //   fontFamily: "Arial",
        //   fontSize: "11px",
        // }}
      >
        {/* HEADER */}
        <div className="receipt-header">
          {/* LEFT SIDE INFO */}
          <div className="receipt-business-info">
            <b>Twin Wash Laundry Services</b>
            <br />
            Mahayahay, Bankal, Lapu-Lapu City
            <br />
            Mobile #: 09162579554
            <br />
            FB Page: Twin Wash Laundry Services
          </div>

          {/* RIGHT SIDE LOGO */}
          <div className="receipt-logo-wrap">
            <img src={logo} alt="TwinWash Logo" className="receipt-logo" />
          </div>
        </div>

        {/* CUSTOMER INFO */}
        <table className="receipt-customer-table">
          <tbody>
            <tr>
              <td>Name:</td>
              <td>{selectedOrder?.customerName}</td>
            </tr>
            <tr>
              <td>Contact #:</td>
              <td></td>
            </tr>
            <tr>
              <td>Date & Time:</td>
              <td>{selectedDate}</td>
            </tr>
          </tbody>
        </table>

        {/* SERVICES + ADD-ONS (ALIGNED TABLE) */}
        <table border="1" className="receipt-items-table">
          <thead>
            <tr>
              <th className="receipt-item-column">Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>

          <tbody>
            {/* MAIN SERVICES */}
            <tr>
              <td>{selectedOrder?.wash > 0 ? "☑" : "☐"} WASH</td>
              <td>{selectedOrder?.wash}</td>
              <td>70</td>
              <td>{(selectedOrder?.wash || 0) * 70}</td>
            </tr>

            <tr>
              <td>{selectedOrder?.dry > 0 ? "☑" : "☐"} DRY</td>
              <td>{selectedOrder?.dry}</td>
              <td>70</td>
              <td>{(selectedOrder?.dry || 0) * 70}</td>
            </tr>

            <tr>
              <td>☐ DROP-OFF</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>

            {/* ADD-ONS HEADER */}
            <tr>
              <td colSpan="4" className="receipt-addons-header">
                Add-Ons
              </td>
            </tr>

            {/* ADD-ONS */}
            <tr>
              <td>
                {selectedOrder?.detergent > 0 ? "☑" : "☐"} LIQUID DETERGENT
              </td>
              <td>{selectedOrder?.detergent}</td>
              <td>18</td>
              <td>{(selectedOrder?.detergent || 0) * 18}</td>
            </tr>

            <tr>
              <td>{selectedOrder?.downy > 0 ? "☑" : "☐"} DOWNY</td>
              <td>{selectedOrder?.downy}</td>
              <td>8</td>
              <td>{(selectedOrder?.downy || 0) * 8}</td>
            </tr>

            <tr>
              <td>{selectedOrder?.zonrox > 0 ? "☑" : "☐"} BLEACH WHITE</td>
              <td>{selectedOrder?.zonrox}</td>
              <td>8</td>
              <td>{(selectedOrder?.zonrox || 0) * 6}</td>
            </tr>
          </tbody>
        </table>

        {/* TOTAL */}
        <table className="grand-total-table" border="1">
          <tbody>
            <tr>
              <td colSpan="3" className="grand-total-label">
                GRAND TOTAL:
              </td>

              <td className="grand-total-value">
                <span className="grand-total-amount">
                  ₱{selectedOrder?.total}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* TERMS */}
        <div className="terms">
          <b>Terms and Conditions</b>
          <br />
          <br />
          <b>MAXIMUM CAPACITY</b>
          <br />
          The maximum load capacity of our washers and dryers is 8-8 kilos of
          clothes with light soil. We reserve the right to weigh the clothes
          loaded by the customer in our machine to meet the load capacity which
          will ensure deaning quality standards. Any heavy soled dothes must be
          washed, or spot cleaned separedly with the right methods, if
          necessary.
          <br />
          <br />
          <b>LIQUID INGREDIENTS</b>
          <br />
          Household general purpose POWDER detergents are NOT allowed to load in
          our front load washing machines. Excess bubbles and suds wil not help
          in this type of cleaning process. The recommended chemical is High
          Efficiency LIQUID Detergent, specially formulated for high efficiency
          washers at the right dosage, DONOT use for hand wash.
          <br />
          <br />
          <b>DRYING TIME</b>
          <br />
          The recommended drying time for 6.8 kilos of mixed clothes is only
          30-40 minutes. This will prevent OVERDRYIG of light fabrics that might
          result to color loss and possible damage. 30-40 minutes wil NOT
          completely dry heavy fabrics like pants and towels. You may extend to
          an additional 10 minutes to completely dry heavy fabrios.
          <br />
          <br />
          <b>LOOSE ITEMS</b>
          <br />
          We are not responsible for any loose items such as cash, coins, belts,
          detachable buttons, zips, jewelries, watches, broaches, ouffinks,
          hoods, pens, lipsticks or any loose items that are detached from
          garments, pockets or which are damaged, dismantled or lost during the
          washing and drying process. The customer is responsible to remove all
          these items and empty their pockets prior to using the machines.
          <br />
          <br />
          <b>DAMAGES TO MATERIALS</b>
          <br />
          The users of our Washers and Dryers must ensure that all the materials
          to be washed are suitable for washing with normal detergents,
          conditioners and normal water conditions. We shall not be responsible
          or iable for any color loss, color bleeding, shrinkage of materials,
          damage to weak andior tender fabrios or whatsoever damages as the case
          maybe, regardless its due to the material weakness, temperature
          settings or defects in our machines.
          <br />
          <br />
          <b>UNATTENDED ITEMS</b>
          <br />
          It is the customer's responsibility to look after their laundry or any
          personal belongings that are left unattended within the laundry
          machines or any parts within the vicinity of our laundry shop. We are
          not liable for any loss of clathes or other personal belongings due to
          theft and other reasons. For lost and found personal items, we will
          exert effort to contact you and inform you of the found belonging but
          if left unclaimed after a period of 2 weeks (14days), it is at the
          sole discretion, the management to decide what to do with the found
          personal item.
          <br />
          <br />
          <b>UNCLAIMED ITEMS</b>
          <br />A 20% storage fee is applied for garments not picked up for more
          than 30 days. Any garments not picked up for 2 months will be donated
          to charity.
          <div className="receipt-signatures">
            <div className="receipt-signature-block">
              <div className="receipt-signature-line">Received By</div>
            </div>

            <div className="receipt-signature-block">
              <div className="receipt-signature-line">Customer's Signature</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
