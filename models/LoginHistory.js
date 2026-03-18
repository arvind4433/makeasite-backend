import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema({

 user:{
  type:mongoose.Schema.Types.ObjectId,
  ref:"User"
 },

 ip:String,

 browser:String,

 os:String,

 device:String,

 loginAt:{
  type:Date,
  default:Date.now
 }

});

export default mongoose.model(
 "LoginHistory",
 loginHistorySchema
);