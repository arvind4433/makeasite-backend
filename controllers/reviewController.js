import Review from "../models/Review.js";

/* create review */

export const createReview = async (req,res)=>{

  const {order,rating,comment} = req.body;

  const review = await Review.create({

    user:req.user._id,
    order,
    rating,
    comment

  });

  res.status(201).json(review);

};


/* get reviews */

export const getReviewsByOrder = async (req,res)=>{

  const reviews = await Review.find({
    order:req.params.orderId
  }).populate("user","name");

  res.json(reviews);

};