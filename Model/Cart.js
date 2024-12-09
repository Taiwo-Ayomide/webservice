const moongoose = require("mongoose");
const CartSchema = new moongoose.Schema(
    {
        cover: {type: String, require: true},
        title: {type: String, require: true},
        price: {type: String, require: true},
    }, { timestamps: true},
);



module.exports = moongoose.model("Cart", CartSchema);