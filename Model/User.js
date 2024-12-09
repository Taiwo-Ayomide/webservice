const moongoose = require("mongoose");
const UserSchema = new moongoose.Schema(
    {
        fullname: { type: String, require: true },
        email: { type: String, require: true },
        nationality: { type: String, require: true },
        password: { type: String, require: true },
        isAdmin: {
            type: Boolean,
            default: false
        },
    }, { timestamps: true },
);


module.exports = moongoose.model("User", UserSchema);