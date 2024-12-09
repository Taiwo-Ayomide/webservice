const moongoose = require("mongoose");
const EbookSchema = new moongoose.Schema(
    {
        imageUrl: { type: String, require: true },
        title: { type: String, require: true },
        description: { type: String, require: true },
        price: { type: String, require: true },
        pages: { type: String, require: true },
        preview: { type: String, require: true },
        isPaid: { type: Boolean, default: false },
    }, { timestamps: true },
);



module.exports = moongoose.model("Ebook", EbookSchema);