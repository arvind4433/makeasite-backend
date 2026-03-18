import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({

  sender:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  receiver:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  order:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Order"
  },

  message:{
    type:String,
    required:true
  },

  attachments:[
    {
      url:String,
      name:String
    }
  ],

  isRead:{
    type:Boolean,
    default:false
  }

},{
  timestamps:true
});

const Message = mongoose.model("Message",messageSchema);

export default Message;