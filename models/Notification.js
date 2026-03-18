import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({

  user:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  title:String,

  message:String,

  type:{
    type:String,
    enum:[
      "order",
      "payment",
      "message",
      "system"
    ]
  },

  isRead:{
    type:Boolean,
    default:false
  }

},{
  timestamps:true
});

const Notification = mongoose.model("Notification",notificationSchema);

export default Notification;