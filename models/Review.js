import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({

  user:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"User"
  },

  order:{
    type:mongoose.Schema.Types.ObjectId,
    ref:"Order"
  },

  rating:{
    type:Number,
    min:1,
    max:5
  },

  comment:String

},{
  timestamps:true
});

const Review = mongoose.model("Review",reviewSchema);

export default Review;