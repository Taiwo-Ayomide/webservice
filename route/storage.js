const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');

// Create storage engine
const storage = new GridFsStorage({
  url: 'your_mongodb_connection_string',
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: 'uploads' // Collection name in MongoDB
    };
  }
});

const upload = multer({ storage });

module.exports = upload;
