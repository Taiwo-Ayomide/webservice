const moongoose = require("mongoose");
const PodcastSchema = new moongoose.Schema(
    {
        title: { type: String, require: true },
        description: { type: String, require: true },
        producers: { type: [String], required: true },
        audioUrl: { type: String, required: true },
    }, { timestamp: true },
);



module.exports = moongoose.model("Podcast", PodcastSchema);