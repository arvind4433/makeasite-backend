import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({

  user:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  order:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Order"
  },

  amount:{
    type:Number,
    required:true
  },

  currency:{
    type:String,
    default:"USD"
  },

  method:{
    type:String,
    enum:["stripe","paypal","razorpay"]
  },

  status:{
    type:String,
    enum:[
      "pending",
      "paid",
      "failed",
      "refunded"
    ],
    default:"pending"
  },

  transactionId:String

},{
  timestamps:true
});

const Payment = mongoose.model("Payment",paymentSchema);

export default Payment;