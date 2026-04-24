import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaMobileAlt, FaMoneyBillWave } from "react-icons/fa";
import OrderSummary from "../components/OrderSummary";
import "../styles/main.css";

function Home({ price, setPrice }) {

const [method,setMethod] = useState("upi");
const navigate = useNavigate();

const handleContinue = () => {

if(method === "upi"){
navigate("/upi");
}else{
navigate("/cash");
}

};

return (

<div className="main-container">

<div className="payment-section">

<h1>Choose Payment Method</h1>
<p className="subtitle">Select how you'd like to pay</p>

{/* UPI CARD */}

<div
className={`payment-card ${method==="upi" ? "active":""}`}
onClick={()=>setMethod("upi")}
>

<div className="icon">
<FaMobileAlt/>
</div>

<div className="card-text">
<h3>UPI</h3>
<p>Pay instantly via Google Pay, PhonePe, Paytm</p>
</div>

<input type="radio" checked={method==="upi"} readOnly/>

</div>

{/* CASH CARD */}

<div
className={`payment-card ${method==="cash" ? "active":""}`}
onClick={()=>setMethod("cash")}
>

<div className="icon">
<FaMoneyBillWave/>
</div>

<div className="card-text">
<h3>Cash</h3>
<p>Pay in cash at collection point</p>
</div>

<input type="radio" checked={method==="cash"} readOnly/>

</div>

<button className="continue-btn" onClick={handleContinue}>
Continue
</button>

</div>

<OrderSummary price={price} setPrice={setPrice}/>

</div>

)

}

export default Home;