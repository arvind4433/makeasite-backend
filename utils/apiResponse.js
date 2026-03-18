export const successResponse = (res,data,message="success")=>{

 return res.status(200).json({
  success:true,
  message,
  data
 });

};

export const errorResponse = (res,message="error",code=400)=>{

 return res.status(code).json({
  success:false,
  message
 });

};