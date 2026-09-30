// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

/**
 * A Firebase Cloud Function triggered by an HTTPS request to permanently delete a user's account
 * and all associated data across the application. It verifies the user's auth token before proceeding.
 * It deletes:
 * - The Firebase Auth user.
 * - The user's document in the 'users' collection.
 * - The user's inventory from any campaigns they were a player in.
 * - Any campaigns owned by the user, along with all sub-collections.
 * @param {functions.https.Request} req - The HTTPS request object.
 * @param {functions.Response} res - The HTTPS response object.
 */
exports.deleteUserAccount = functions.https.onRequest((req, res) => {
  // Manually handle CORS to allow requests from your website
  cors(req, res, async () => {
    // Check for an authentication token in the request headers
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
      console.error('No Firebase ID token was passed in the Authorization header.');
      res.status(401).send({ error: { message: 'Unauthorized: No token provided.' } });
      return;
    }

    const idToken = req.headers.authorization.split('Bearer ')[1];

    try {
      // Manually verify the token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // --- The rest of the deletion logic is the same ---
      await admin.auth().deleteUser(uid);
      const batch = db.batch();
      const userDocRef = db.collection("users").doc(uid);
      batch.delete(userDocRef);
      const campaignsQuery = await db.collection("campaigns")
          .where("players", "array-contains", uid).get();
      campaignsQuery.forEach((campaignDoc) => {
        const inventoryDocRef = campaignDoc.ref.collection("inventories").doc(uid);
        batch.delete(inventoryDocRef);
        batch.update(campaignDoc.ref, {
          players: admin.firestore.FieldValue.arrayRemove(uid),
        });
      });
       const ownedCampaignsQuery = await db.collection("campaigns")
        .where("dmId", "==", uid).get();
      const deleteSubcollectionsPromises = [];
      ownedCampaignsQuery.forEach((campaignDoc) => {
          const inventoriesRef = campaignDoc.ref.collection("inventories");
          const deletePromise = inventoriesRef.get().then(invSnapshot => {
              invSnapshot.forEach(doc => batch.delete(doc.ref));
          });
          deleteSubcollectionsPromises.push(deletePromise);
          batch.delete(campaignDoc.ref);
      });
      await Promise.all(deleteSubcollectionsPromises);
      await batch.commit();

      res.status(200).send({ data: { success: true, message: "Account deleted successfully." } });
    } catch (error) {
      console.error("Error during account deletion:", error);
      res.status(500).send({ error: { message: "An internal error occurred." } });
    }
  });
});