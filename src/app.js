require("dotenv").config();
const express = require("express");
const app = express();
const transferSPLtoken =require("./utils/transfer");
app.use(express.json());

app.post("/buy", async (req, res) => {
  const {
    body: { amount },
  } = req;
  try {
    const confirmation = await transferSPLtoken();
    res.json(confirmation).status(200);
  } catch (error) {
    console.error(error);
    res.json({error: "token transfer failed"}).status(400);
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});