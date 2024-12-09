const moongoose = require("mongoose");
const BlogSchema = new moongoose.Schema(
    {
        headline: { type: String, require: true },
        description: { type: String, require: true },
        author: { type: String, require: true },
    }, { timestamps: true },
);



module.exports = moongoose.model("Blog", BlogSchema);