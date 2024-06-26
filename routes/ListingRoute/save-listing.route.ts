import { Request, Response, Router } from "express";
import { check, validationResult } from "express-validator";
import networkType, { TESTNET } from "../../config/config";
import Order from "../../model/OrderModel";
import * as Bitcoin from "bitcoinjs-lib";
import ecc from "@bitcoinerlab/secp256k1";
import { getInscriptionInfo } from "../../utils/unisat.api";
import { IOrderData } from "../../utils/types";

Bitcoin.initEccLib(ecc);

interface IUtxo {
  txid: string;
  vout: number;
  value: number;
}

//create a new instance of the express router
const SaveListingRouter = Router();

// @route    POST api/save-listing
// @desc     Save signed seller Psbt and additional info
// @access   Private

SaveListingRouter.post(
  "/save-listing",
  check("sellerOrdinalId", "SellerOrdinals is required").notEmpty(),
  check("sellerOrdinalPrice", "SellerOrdinalPrice is required").notEmpty(),
  check("sellerPaymentAddress", "SellerPaymentAddresss is required").notEmpty(),
  check(
    "sellerOrdinalPublicKey",
    "SellerOrdinalPublicKey is required"
  ).notEmpty(),
  check("signedListingPSBT", "SignedListingPSBT is required").notEmpty(),

  async (req: Request, res: Response) => {
    try {
      // Validate Form Inputs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array() });
      }
      // Getting parameter from request
      const {
        sellerOrdinalId,
        sellerOrdinalPrice,
        sellerPaymentAddress,
        sellerOrdinalPublicKey,
        signedListingPSBT,
      } = req.body;

      // Check if this ordinalId exists on database.
      const ordinalExists = await Order.findOne({ ordinalId: sellerOrdinalId });
      if (ordinalExists) {
        return res
          .status(400)
          .json({ error: "This Ordinal is already listed." });
      }

      // Get Inscription UTXO info from inscription id
      const ordinalUTXO = await getInscriptionInfo(
        sellerOrdinalId,
        networkType ?? ""
      );

      // Create new instance to save new Order
      const newOrderData: IOrderData = {
        ordinalId: sellerOrdinalId,
        price: +sellerOrdinalPrice,
        sellerPaymentAddress: sellerPaymentAddress,
        sellerOrdinalPublicKey: sellerOrdinalPublicKey,
        status: "Active",
        ordinalUtxoTxId: ordinalUTXO.txid,
        ordinalUtxoVout: ordinalUTXO.vout,
        serviceFee: +sellerOrdinalPrice / 100,
        signedListingPSBT: signedListingPSBT,
      };

      // Create new order Data schema
      const newOrder = new Order({ ...newOrderData });

      // Save new Order Data
      const savedOrder = await newOrder.save();

      return res.status(200).send({ data: savedOrder });
    } catch (error: any) {
      console.log(error.message);
      return res.status(500).send({ error });
    }
  }
);

export default SaveListingRouter;