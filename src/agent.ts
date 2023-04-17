import {
  AnonCredsModule,
  LegacyIndyCredentialFormatService,
  V1CredentialProtocol,
} from "@aries-framework/anoncreds";
import {
  Agent,
  InitConfig,
  ConnectionEventTypes,
  ConnectionStateChangedEvent,
  WsOutboundTransport,
  HttpOutboundTransport,
  DidExchangeState,
  OutOfBandRecord,
  ConnectionsModule,
  ConsoleLogger,
  LogLevel,
  DidsModule,
  KeyType,
  TypedArrayEncoder,
  ConnectionRecord,
  CredentialsModule,
  AutoAcceptCredential,
  CredentialStateChangedEvent,
  CredentialEventTypes,
  CredentialExchangeRecord,
  CredentialState,
  DidCommMimeType,
} from "@aries-framework/core";
import indySdk from "indy-sdk";
import { agentDependencies, HttpInboundTransport } from "@aries-framework/node";

import { BCOVRIN_TEST_NETWORK } from "./genesis";
import {
  IndySdkAnonCredsRegistry,
  IndySdkIndyDidRegistrar,
  IndySdkIndyDidResolver,
  IndySdkModule,
} from "@aries-framework/indy-sdk";

export const issuerId = "did:indy:bcovrin:test:WUTE5T3VAPYS46ph5bLkUt";
export const legacyIssuerId = "WUTE5T3VAPYS46ph5bLkUt";

const modules = {
  indySdk: new IndySdkModule({
    indySdk,
    networks: [
      {
        isProduction: false,
        indyNamespace: "bcovrin:test",
        genesisTransactions: BCOVRIN_TEST_NETWORK,
        connectOnStartup: true,
      },
    ],
  }),
  anoncreds: new AnonCredsModule({
    registries: [new IndySdkAnonCredsRegistry()],
  }),
  dids: new DidsModule({
    registrars: [new IndySdkIndyDidRegistrar()],
    resolvers: [new IndySdkIndyDidResolver()],
  }),
  connections: new ConnectionsModule({
    autoAcceptConnections: true,
  }),
  credentials: new CredentialsModule({
    autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
    credentialProtocols: [
      new V1CredentialProtocol({
        indyCredentialFormat: new LegacyIndyCredentialFormatService(),
      }),
    ],
  }),
};

type AppAgent = Agent<typeof modules>;

export const initializeBobAgent = async (endpoint: string, port: number) => {
  // Simple agent configuration. This sets some basic fields like the wallet
  // configuration and the label. It also sets the mediator invitation url,
  // because this is most likely required in a mobile environment.
  const config: InitConfig = {
    label: "demo-agent-bob",
    walletConfig: {
      id: "mainBob",
      key: "demoagentbob00000000000000000000",
    },
    logger: new ConsoleLogger(LogLevel.trace),
    endpoints: [endpoint],
    useDidSovPrefixWhereAllowed: true,
    didCommMimeType: DidCommMimeType.V0,
  };

  // A new instance of an agent is created here
  // Askar can also be replaced by the indy-sdk if required
  const agent = new Agent({
    config,
    modules,
    dependencies: agentDependencies,
  });

  // Register a simple `WebSocket` outbound transport
  agent.registerOutboundTransport(new WsOutboundTransport());

  // Register a simple `Http` outbound transport
  agent.registerOutboundTransport(new HttpOutboundTransport());

  agent.registerInboundTransport(new HttpInboundTransport({ port }));

  // Initialize the agent
  await agent.initialize();

  return agent as unknown as AppAgent;
};

export const createLegacyInvitation = async (agent: Agent) => {
  const { invitation, outOfBandRecord } =
    await agent.oob.createLegacyInvitation({ multiUseInvitation: true });

  return {
    invitationUrl: invitation.toUrl({
      domain: "https://example.org",
      useDidSovPrefixWhereAllowed: true,
    }),
    outOfBandRecord,
  };
};

export const prepareCredentialIssuance = async (agent: AppAgent) => {
  await agent.dids.import({
    overwrite: true,
    did: issuerId,
    privateKeys: [
      {
        keyType: KeyType.Ed25519,
        privateKey: TypedArrayEncoder.fromString(
          "asdfasfasdfasdf00000000000000000"
        ),
      },
    ],
  });

  const { schemaState } = await agent.modules.anoncreds.registerSchema({
    schema: {
      attrNames: ["Name"],
      issuerId,
      name: "Name",
      version: `1.${Math.random()}`,
    },
    options: {},
  });

  if (schemaState.state !== "finished") {
    throw new Error("Error creating schema");
  }

  // Create a new credential definition
  const { credentialDefinitionState } =
    await agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition: {
        schemaId: schemaState.schemaId,
        issuerId,
        tag: "hello",
      },
      options: {},
    });

  if (credentialDefinitionState.state !== "finished") {
    throw new Error("Error creating credential definition");
  }

  return {
    credentialDefinitionId: credentialDefinitionState.credentialDefinitionId,
  };
};

export const setupConnectionListener = (
  agent: Agent,
  outOfBandRecord: OutOfBandRecord,
  cb: (connectionRecord: ConnectionRecord) => void | Promise<void>
) => {
  agent.events.on<ConnectionStateChangedEvent>(
    ConnectionEventTypes.ConnectionStateChanged,
    ({ payload }) => {
      if (payload.connectionRecord.outOfBandId !== outOfBandRecord.id) return;
      if (
        payload.connectionRecord.state === DidExchangeState.Completed ||
        payload.connectionRecord.state === DidExchangeState.ResponseSent
      ) {
        // the connection is now ready for usage in other protocols!
        console.log(
          `Connection for out-of-band id ${outOfBandRecord.id} completed`
        );

        // Custom business logic can be included here
        // In this example we can send a basic message to the connection, but
        // anything is possible
        cb(payload.connectionRecord);
      }
    }
  );
};

export const setupCredentialListener = (
  agent: Agent,
  cb: (
    credentialExchangeRecord: CredentialExchangeRecord
  ) => void | Promise<void>
) => {
  agent.events.on<CredentialStateChangedEvent>(
    CredentialEventTypes.CredentialStateChanged,
    ({ payload }) => {
      if (payload.credentialRecord.state === CredentialState.CredentialIssued) {
        // the connection is now ready for usage in other protocols!
        console.log(
          `Credential for credential exchange record ${payload.credentialRecord.id} has been issued.`
        );

        // Custom business logic can be included here
        // In this example we can send a basic message to the connection, but
        // anything is possible
        cb(payload.credentialRecord);
      }
    }
  );
};
