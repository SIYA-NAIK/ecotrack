import {useState} from "react";
import {FaEdit} from "react-icons/fa";

function OrderSummary({price,setPrice}){

const [edit,setEdit] = useState(false);

const gst = price * 0.18;
const total = Math.round(price + gst);

return(

<div className="summary">

<h2>Order Summary</h2>

<div className="plan">

<div>
<h4>Amount to be paid</h4>
<p className="green"></p>
</div>

<div className="price-section">

{edit ? (

<input
type="number"
value={price}
onChange={(e)=>setPrice(Number(e.target.value))}
onBlur={()=>setEdit(false)}
className="price-input"
autoFocus
/>

) : (

<span className="price">₹{price}</span>

)}

<FaEdit
className="edit-icon"
onClick={()=>setEdit(true)}
/>

</div>

</div>

<hr/>

<div className="row">
<span>Subtotal</span>
<span>₹{price}</span>
</div>

<div className="row">
<span>GST (18%)</span>
<span>₹{gst.toFixed(0)}</span>
</div>

<div className="row total">
<span>Total</span>
<span>₹{total}</span>
</div>

</div>

)

}

export default OrderSummary