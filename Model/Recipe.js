const moongoose = require("mongoose");
const RecipeSchema = new moongoose.Schema(
    {
        imageUrl: {type: String, require: true},
        backgroundstory: {type: String, require: true},
        ingredients: {type: String, require: true},
        steps: {type: String, require: true},
    }, { timestamps: true },
);



module.exports = moongoose.model("Recipe", RecipeSchema);