import qrcode from "qrcode-terminal";
import readline from "readline";
import { connect } from "ngrok";
import {
  createLegacyInvitation,
  initializeBobAgent,
  prepareCredentialIssuance,
  setupConnectionListener,
  setupCredentialListener,
} from "./agent";
import { legacyIssuerId } from "./agent";
const run = async () => {
  const port = 3001;
  console.log("Initializing Bob agent...");
  const url = await connect(port);
  const bobAgent = await initializeBobAgent(url, port);

  const { credentialDefinitionId } = await prepareCredentialIssuance(bobAgent);

  console.log("Creating the invitation as Bob");

  console.log("Listening for connection changes...");
  const { invitationUrl, outOfBandRecord } = await createLegacyInvitation(
    bobAgent
  );
  setupConnectionListener(
    bobAgent,
    outOfBandRecord,
    async (connectionRecord) => {
      console.log(
        "We now have an active connection to use in the following tutorials"
      );

      const [did, anoncreds, v0, claim_def, schemaSeqNo, tag] =
        credentialDefinitionId.split("/");

      const legacyCredDef = `${legacyIssuerId}:3:CL:${schemaSeqNo}:${tag}`;
      await bobAgent.credentials.offerCredential({
        connectionId: connectionRecord.id,
        protocolVersion: "v1",
        credentialFormats: {
          indy: {
            credentialDefinitionId: legacyCredDef,
            attributes: [
              {
                name: "Name",
                value: "Berend Botje",
              },
            ],
          },
        },
      });

      console.log("Offered credential");
    }
  );

  setupCredentialListener(bobAgent, async (credentialRecord) => {
    console.log("Done!");
  });

  qrcode.generate(invitationUrl, { small: true });
  console.log(invitationUrl);
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.on("SIGINT", () => {
  rl.question("Are you sure you want to exit? (y/n) ", (answer) => {
    if (answer.toLowerCase() === "y") {
      rl.close();
      process.exit(0);
    }
  });
});

void run();

console.log("The application is running. Press ctrl+c to exit.");
