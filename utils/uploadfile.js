
import multer from 'multer';
import path from 'path';

const OurStorage = multer.diskStorage({
    destination : (req,file,cb) => {
        cb(null,"./public/upload")

    },
    filename : (req,file,cb) => {
       
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
     const filename =  uniqueSuffix+path.extname(file.originalname);
    
    cb(null,filename)
    }
});

const upload = multer({storage:OurStorage})
export default upload;
