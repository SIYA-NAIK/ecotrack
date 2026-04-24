function QRScanner({amount}){

const upiLink =
`upi://pay?pa=demo@upi&pn=EcoTracker&am=${amount}&cu=INR`;

const qrURL =
`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiLink)}`;

return(

<div className="qr-wrapper">

<div className="qr-box">

<img src={qrURL} alt="QR Code"/>

<div className="scan-line"></div>

</div>

<p className="qr-text">
Scan QR with GPay / PhonePe / Paytm
</p>

</div>

)

}

export default QRScanner;