require("dotenv").config();
const express = require("express");
const app = express();
const transferSPLtoken =require("./utils/transfer");
app.use(express.json());

const MAIN_PRICE = 0.0000101471;
const startTime = new Date().getTime();
console.log("start time: ", startTime);

let price = MAIN_PRICE;

function getPrice() {
  let price = MAIN_PRICE;
  const now = new Date().getTime();
  console.log("now time: ", now);
  let offset = Math.floor((now - startTime) / 86400 / 1000);
  console.log("offset: ", offset);
  while(offset >= 3){
    price = price + (price * 0.1);
    offset -= 3;
  }
  console.log("price", price);
  return price;
}

app.post("/buy", async (req, res) => {
  const {
    body: { to, sol },
  } = req;
  try {
    const price = getPrice();
    const amount = Math.floor(sol / price);
    console.log("amount: ", amount);
    const confirmation = await transferSPLtoken(to, amount);
    res.json(confirmation).status(200);
  } catch (error) {
    console.error(error);
    res.json({error: "token transfer failed"}).status(400);
  }
});

app.get("/price", async (_, res) => {
  const price = getPrice();
  res.json({price: price}).status(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
