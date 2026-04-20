import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import logo from "./assets/twinwash-laundry.jpg";
import * as XLSX from "xlsx";
import { db } from "./firebase";
import "./tablet.css";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
const PRICES = {
  wash: 70,
  dry: 70,
  detergent: 18,
  downy: 8,
  zonrox: 6,
};
export default function App() {
  const customerInputRef = useRef(null);

  const [orders, setOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [customerName, setCustomerName] = useState("");
  const [wash, setWash] = useState(0);
  const [dry, setDry] = useState(0);
  const [detergent, setDetergent] = useState(0);
  const [downy, setDowny] = useState(0);
  const [zonrox, setZonrox] = useState(0);
  const [cashReceived, setCashReceived] = useState("");

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [claimFilter, setClaimFilter] = useState("All");

  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  const generateReceiptNo = () => {
    return `TW-${Date.now().toString().slice(-8)}`;
  };

  const formatCurrency = (value) => `₱${Number(value || 0).toFixed(2)}`;

  const formatDateTime = (value) => {
    if (!value) return "";
    try {
      const date = value?.toDate ? value.toDate() : new Date(value);
      return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const calculateTotal = useCallback(() => {
    return (
      wash * PRICES.wash +
      dry * PRICES.dry +
      detergent * PRICES.detergent +
      downy * PRICES.downy +
      zonrox * PRICES.zonrox
    );
  }, [wash, dry, detergent, downy, zonrox]);

  const currentTotal = calculateTotal();

  const currentChange = useMemo(() => {
    const cash = Number(cashReceived || 0);
    return cash > 0 ? Math.max(cash - currentTotal, 0) : 0;
  }, [cashReceived, currentTotal]);

  const resetForm = () => {
    setCustomerName("");
    setWash(0);
    setDry(0);
    setDetergent(0);
    setDowny(0);
    setZonrox(0);
    setCashReceived("");
    setEditingOrderId(null);
    customerInputRef.current?.focus();
  };

  const fetchOrders = useCallback(async (date) => {
    const snapshot = await getDocs(collection(db, "orders", date, "items"));
    const data = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    setOrders(data);
  }, []);

  useEffect(() => {
    fetchOrders(selectedDate);
  }, [selectedDate, fetchOrders]);

  const addOrUpdateOrder = async () => {
    if (!customerName.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (currentTotal <= 0) {
      alert("Please add at least one service or add-on.");
      return;
    }

    const cash = Number(cashReceived || 0);
    const isPaid = cash > 0 && cash >= currentTotal;

    const payload = {
      customerName: customerName.trim(),
      wash,
      dry,
      detergent,
      downy,
      zonrox,
      total: currentTotal,
      cashReceived: cash || 0,
      change: isPaid ? cash - currentTotal : 0,
      paymentStatus: isPaid ? "Paid" : "Unpaid",
      claimStatus: editingOrderId
        ? orders.find((o) => o.id === editingOrderId)?.claimStatus ||
          "Unclaimed"
        : "Unclaimed",
      receiptNo: editingOrderId
        ? orders.find((o) => o.id === editingOrderId)?.receiptNo ||
          generateReceiptNo()
        : generateReceiptNo(),
      createdAt: editingOrderId
        ? orders.find((o) => o.id === editingOrderId)?.createdAt || new Date()
        : new Date(),
      updatedAt: new Date(),
    };

    if (editingOrderId) {
      await updateDoc(
        doc(db, "orders", selectedDate, "items", editingOrderId),
        payload,
      );
    } else {
      await addDoc(collection(db, "orders", selectedDate, "items"), payload);
    }

    await fetchOrders(selectedDate);
    resetForm();
  };

  const editOrder = (order) => {
    setEditingOrderId(order.id);
    setCustomerName(order.customerName || "");
    setWash(Number(order.wash || 0));
    setDry(Number(order.dry || 0));
    setDetergent(Number(order.detergent || 0));
    setDowny(Number(order.downy || 0));
    setZonrox(Number(order.zonrox || 0));
    setCashReceived(order.cashReceived ? String(order.cashReceived) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => customerInputRef.current?.focus(), 200);
  };

  const deleteOrder = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this order?",
    );
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "orders", selectedDate, "items", id));
    await fetchOrders(selectedDate);

    if (editingOrderId === id) {
      resetForm();
    }
  };

  const markPaid = async (order) => {
    if (order.paymentStatus === "Paid") {
      alert("This order is already marked as Paid.");
      return;
    }

    const input = window.prompt(
      `Enter cash received for ${order.customerName}\nTotal: ${formatCurrency(order.total)}`,
      order.total,
    );

    if (input === null) return;

    const cash = Number(input);

    if (Number.isNaN(cash) || cash < Number(order.total)) {
      alert(
        "Cash received must be a valid amount and not less than the total.",
      );
      return;
    }

    await updateDoc(doc(db, "orders", selectedDate, "items", order.id), {
      paymentStatus: "Paid",
      cashReceived: cash,
      change: cash - Number(order.total),
      updatedAt: new Date(),
    });

    await fetchOrders(selectedDate);
  };

  const markClaimed = async (order) => {
    await updateDoc(doc(db, "orders", selectedDate, "items", order.id), {
      claimStatus: order.claimStatus === "Claimed" ? "Unclaimed" : "Claimed",
      updatedAt: new Date(),
    });
    await fetchOrders(selectedDate);
  };

  const printReceipt = () => {
    const receipt = document.getElementById("receipt");
    if (!receipt) return;

    receipt.style.display = "block";
    window.print();

    setTimeout(() => {
      receipt.style.display = "none";
    }, 500);
  };

  const handlePrint = (order) => {
    setSelectedOrder(order);
    setTimeout(() => {
      printReceipt();
    }, 250);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = (o.customerName || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesPayment =
      paymentFilter === "All" ? true : o.paymentStatus === paymentFilter;

    const matchesClaim =
      claimFilter === "All" ? true : o.claimStatus === claimFilter;

    return matchesSearch && matchesPayment && matchesClaim;
  });

  const dailyTotal = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalPaid = orders
    .filter((o) => o.paymentStatus === "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalUnpaid = orders
    .filter((o) => o.paymentStatus !== "Paid")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalClaimed = orders
    .filter((o) => o.claimStatus === "Claimed")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalUnclaimed = orders
    .filter((o) => o.claimStatus !== "Claimed")
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const closeDayReport = () => {
    alert(
      `🧾 DAILY REPORT\n\n` +
        `📅 Date: ${selectedDate}\n` +
        `📦 Orders: ${orders.length}\n\n` +
        `💰 Total Sales: ${formatCurrency(dailyTotal)}\n` +
        `✅ Total Paid: ${formatCurrency(totalPaid)}\n` +
        `⏳ Total Unpaid: ${formatCurrency(totalUnpaid)}\n`,
      // `📦 Total Claimed: ${formatCurrency(totalClaimed)}\n` +
      // `🕒 Total Unclaimed: ${formatCurrency(totalUnclaimed)}`,
    );
  };

  const downloadExcelReport = () => {
    const exportData = orders.map((o) => ({
      Date: selectedDate,
      ReceiptNo: o.receiptNo || "",
      Customer: o.customerName,
      Wash: o.wash,
      Dry: o.dry,
      Detergent: o.detergent,
      Downy: o.downy,
      Zonrox: o.zonrox,
      Total: o.total,
      CashReceived: o.cashReceived || 0,
      Change: o.change || 0,
      Payment: o.paymentStatus,
      Claim: o.claimStatus,
      CreatedAt: formatDateTime(o.createdAt),
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Report");
    XLSX.writeFile(workbook, `Laundry_Report_${selectedDate}.xlsx`);
  };

  return (
    <div className="app-container">
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

      <div className="dashboard-grid">
        <div className="summary-card">
          <span className="summary-label">Total Orders</span>
          <span className="summary-value">{orders.length}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Sales</span>
          <span className="summary-value">{formatCurrency(dailyTotal)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Paid</span>
          <span className="summary-value paid-text">
            {formatCurrency(totalPaid)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Unpaid</span>
          <span className="summary-value unpaid-text">
            {formatCurrency(totalUnpaid)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Claimed</span>
          <span className="summary-value claimed-text">
            {formatCurrency(totalClaimed)}
          </span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Unclaimed</span>
          <span className="summary-value unclaimed-text">
            {formatCurrency(totalUnclaimed)}
          </span>
        </div>
      </div>

      <div className="main-layout">
        <div
          className="left-panel card"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addOrUpdateOrder();
            }
          }}
        >
          <div className="form-header">
            <h3>{editingOrderId ? "✏️ Edit Order" : "➕ New Order"}</h3>
            {editingOrderId && (
              <button className="btn-cancel" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>

          <input
            ref={customerInputRef}
            placeholder="Customer Name"
            className="input-large customer-input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          {[
            ["Wash", wash, setWash],
            ["Dry", dry, setDry],
            ["Liquid Detergent", detergent, setDetergent],
            ["Downy", downy, setDowny],
            ["Zonrox", zonrox, setZonrox],
          ].map(([label, value, setter]) => (
            <div className="counter-row" key={label}>
              <span className="counter-label">{label}</span>

              <div className="counter-controls">
                <button
                  className="btn-small"
                  onClick={() => setter(Math.max(Number(value) - 1, 0))}
                  disabled={value === 0}
                >
                  -
                </button>

                <span className="counter-value">{value}</span>

                <button
                  className="btn-small"
                  onClick={() => setter(Number(value) + 1)}
                >
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="payment-box">
            <label>Cash Received</label>
            <input
              type="number"
              min="0"
              placeholder="Enter cash amount"
              className="input-large"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
            />
            <div className="payment-summary">
              <div>
                <span>Total</span>
                <strong>{formatCurrency(currentTotal)}</strong>
              </div>
              <div>
                <span>Change</span>
                <strong>{formatCurrency(currentChange)}</strong>
              </div>
            </div>
          </div>

          <div className="total-row">
            <div className="total-circle">
              <span className="total-label">TOTAL</span>
              <span className="total-amount">
                {formatCurrency(currentTotal)}
              </span>
            </div>
          </div>

          <div className="action-buttons">
            <button className="btn-primary" onClick={addOrUpdateOrder}>
              {editingOrderId ? "Update Order" : "Add Order"}
            </button>

            <button className="btn-success" onClick={downloadExcelReport}>
              📥 Download Excel Report
            </button>
          </div>
        </div>

        <div className="pos-right card">
          <div className="table-toolbar">
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Search customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
              >
                <option value="All">All Payment</option>
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>

              <select
                value={claimFilter}
                onChange={(e) => setClaimFilter(e.target.value)}
              >
                <option value="All">All Claim</option>
                <option value="Claimed">Claimed</option>
                <option value="Unclaimed">Unclaimed</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="orders-table" border="1" cellPadding="10">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Claim</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => (
                    <tr key={o.id}>
                      <td title={o.customerName}>{o.customerName}</td>
                      <td className="amount-cell">{formatCurrency(o.total)}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            o.paymentStatus === "Paid"
                              ? "paid-badge"
                              : "unpaid-badge"
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            o.claimStatus === "Claimed"
                              ? "claimed-badge"
                              : "unclaimed-badge"
                          }`}
                        >
                          {o.claimStatus}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-buttons">
                          <button onClick={() => editOrder(o)}>✏️ Edit</button>
                          <button onClick={() => markPaid(o)}>💰 Paid</button>
                          <button onClick={() => markClaimed(o)}>
                            📦 Claim
                          </button>
                          <button onClick={() => deleteOrder(o.id)}>
                            🗑 Delete
                          </button>
                          <button onClick={() => handlePrint(o)}>
                            🧾 Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pos-brand-footer">
            <span>TwinWash POS</span>
            <img src={logo} alt="TwinWash Logo" />
          </div>
        </div>
      </div>

      <div id="receipt" className="receipt">
        <div className="receipt-header">
          <div className="receipt-business-info">
            <b>Twin Wash Laundry Services</b>
            <br />
            Mahayahay, Bankal, Lapu-Lapu City
            <br />
            Mobile #: 09162579554
            <br />
            FB Page: Twin Wash Laundry Services
          </div>

          <div className="receipt-logo-wrap">
            <img src={logo} alt="TwinWash Logo" className="receipt-logo" />
          </div>
        </div>

        <h3 className="receipt-title">ACKNOWLEDGEMENT RECEIPT</h3>

        <table className="receipt-customer-table">
          <tbody>
            <tr>
              <td>Receipt No:</td>
              <td>{selectedOrder?.receiptNo}</td>
            </tr>
            <tr>
              <td>Name:</td>
              <td>{selectedOrder?.customerName}</td>
            </tr>
            <tr>
              <td>Date & Time:</td>
              <td>{formatDateTime(selectedOrder?.createdAt)}</td>
            </tr>
            <tr>
              <td>Payment:</td>
              <td>{selectedOrder?.paymentStatus}</td>
            </tr>
          </tbody>
        </table>

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
            <tr>
              <td>{selectedOrder?.wash > 0 ? "☑" : "☐"} WASH</td>
              <td>{selectedOrder?.wash || 0}</td>
              <td>70</td>
              <td>{(selectedOrder?.wash || 0) * 70}</td>
            </tr>

            <tr>
              <td>{selectedOrder?.dry > 0 ? "☑" : "☐"} DRY</td>
              <td>{selectedOrder?.dry || 0}</td>
              <td>70</td>
              <td>{(selectedOrder?.dry || 0) * 70}</td>
            </tr>

            <tr>
              <td colSpan="4" className="receipt-addons-header">
                Add-Ons
              </td>
            </tr>

            <tr>
              <td>
                {selectedOrder?.detergent > 0 ? "☑" : "☐"} LIQUID DETERGENT
              </td>
              <td>{selectedOrder?.detergent || 0}</td>
              <td>18</td>
              <td>{(selectedOrder?.detergent || 0) * 18}</td>
            </tr>

            <tr>
              <td>{selectedOrder?.downy > 0 ? "☑" : "☐"} DOWNY</td>
              <td>{selectedOrder?.downy || 0}</td>
              <td>8</td>
              <td>{(selectedOrder?.downy || 0) * 8}</td>
            </tr>

            <tr>
              <td>{selectedOrder?.zonrox > 0 ? "☑" : "☐"} ZONROX</td>
              <td>{selectedOrder?.zonrox || 0}</td>
              <td>6</td>
              <td>{(selectedOrder?.zonrox || 0) * 6}</td>
            </tr>
          </tbody>
        </table>

        <table className="grand-total-table" border="1">
          <tbody>
            <tr>
              <td colSpan="3" className="grand-total-label">
                GRAND TOTAL:
              </td>
              <td className="grand-total-value">
                <span className="grand-total-amount">
                  {formatCurrency(selectedOrder?.total)}
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan="3" className="grand-total-label">
                CASH RECEIVED:
              </td>
              <td className="grand-total-value">
                {formatCurrency(selectedOrder?.cashReceived || 0)}
              </td>
            </tr>
            <tr>
              <td colSpan="3" className="grand-total-label">
                CHANGE:
              </td>
              <td className="grand-total-value">
                {formatCurrency(selectedOrder?.change || 0)}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="receipt-terms-table">
          <tbody>
            <tr>
              <td colSpan="2" className="terms-heading">
                TERMS AND CONDITIONS
              </td>
            </tr>
            <tr>
              <td className="terms-title">MAXIMUM CAPACITY</td>
              <td>
                The maximum load capacity of our washers and dryers is 8 kilos.
                Overloading may affect cleaning quality and machine performance.
              </td>
            </tr>
            <tr>
              <td className="terms-title">LIQUID DETERGENT</td>
              <td>
                Only high-efficiency liquid detergent is recommended for
                front-load washing machines. Powder detergent is not allowed.
              </td>
            </tr>
            <tr>
              <td className="terms-title">DRYING TIME</td>
              <td>
                Recommended drying time for mixed clothes is 30 to 40 minutes.
                Heavy fabrics may require additional drying time.
              </td>
            </tr>
            <tr>
              <td className="terms-title">LOOSE ITEMS</td>
              <td>
                Customers must remove coins, cash, jewelry, pens, and other
                loose items before washing. We are not liable for loss or
                damage.
              </td>
            </tr>
            <tr>
              <td className="terms-title">MATERIAL DAMAGE</td>
              <td>
                We are not responsible for color loss, shrinkage, fabric
                weakness, or damage due to unsuitable garment material or care
                condition.
              </td>
            </tr>
            <tr>
              <td className="terms-title">UNATTENDED ITEMS</td>
              <td>
                Customers are responsible for their laundry and personal
                belongings left unattended inside the shop premises.
              </td>
            </tr>
            <tr>
              <td className="terms-title">UNCLAIMED ITEMS</td>
              <td>
                A 20% storage fee applies to garments not claimed after 30 days.
                Items unclaimed after 2 months may be donated to charity.
              </td>
            </tr>
          </tbody>
        </table>

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
  );
}
