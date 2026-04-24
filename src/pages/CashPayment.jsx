import { useNavigate } from "react-router-dom";
import axios from "axios";
import OrderSummary from "../components/OrderSummary";
import "../styles/main.css";

function CashPayment({ price, setPrice }) {

const navigate = useNavigate();

const gst = Math.round(price * 0.18);
const total = price + gst;

const referenceId = "ECO-" + Math.floor(1000 + Math.random() * 9000);

const confirmPayment = async () => {
try {

await axios.post("http://localhost:5000/pay", {
payment_type: "Cash",
amount: total,
reference_id: referenceId,
location: "EcoHub Center MG Road"
});

alert("Payment Saved Successfully");

navigate("/success");

} catch (err) {
console.error(err);
alert("Payment failed");
}
};

return (

<div className="main-container">

<div className="payment-section">

<button className="back-btn" onClick={()=>navigate("/")}>
← Back
</button>

<h1>Cash Payment</h1>
<p className="subtitle">Complete your payment details</p>

<div className="payment-card active">

<div className="card-text">
<h3>Cash Payment</h3>
<p>Pay ₹{total} at the nearest collection center</p>
</div>

</div>

<div className="cash-details">

<p><strong>Reference ID:</strong> {referenceId}</p>
<p><strong>Valid Until:</strong> March 10, 2026</p>
<p><strong>Location:</strong> EcoHub Center MG Road</p>

</div>

<button className="continue-btn" onClick={confirmPayment}>
Confirm Cash Payment
</button>

</div>

<OrderSummary price={price} setPrice={setPrice} />

</div>

);

}

export default CashPayment;