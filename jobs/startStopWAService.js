const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

async function railwayRequest(query, variables = {}) {
  const response = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RAILWAY_WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const result = await response.json();

  if (!response.ok || result.errors) {
    throw new Error(JSON.stringify(result.errors || result));
  }

  return result.data;
}

// START WhatsApp Service
async function startWhatsAppService() {
  const mutation = `
    mutation($input: EnvironmentTriggersDeployInput!) {
      environmentTriggersDeploy(input: $input)
    }
  `;

  await railwayRequest(mutation, {
    input: {
      projectId: process.env.RAILWAY_WA_PROJECT_ID,
      environmentId: process.env.RAILWAY_WA_ENVIRONMENT_ID,
      serviceId: process.env.RAILWAY_WA_SERVICE_ID,
    },
  });

  console.log("🟢 Perintah START WhatsApp berhasil dikirim ke Railway");
}

// STOP WhatsApp Service
async function stopWhatsAppService() {
  const query = `
    query($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges {
          node {
            id
            status
          }
        }
      }
    }
  `;

  const data = await railwayRequest(query, {
    input: {
      projectId: process.env.RAILWAY_WA_PROJECT_ID,
      environmentId: process.env.RAILWAY_WA_ENVIRONMENT_ID,
      serviceId: process.env.RAILWAY_WA_SERVICE_ID,
    },
    first: 1,
  });

  const deployment = data.deployments.edges[0]?.node;

  if (!deployment || deployment.status !== "SUCCESS") {
    console.log("ℹ️ Tidak ada deployment aktif yang perlu dihentikan.");
    return;
  }

  const mutation = `
    mutation($id: String!) {
      deploymentRemove(id: $id)
    }
  `;

  await railwayRequest(mutation, {
    id: deployment.id,
  });

  console.log("🔴 Perintah STOP WhatsApp berhasil dikirim ke Railway");
}

module.exports = {
  startWhatsAppService,
  stopWhatsAppService,
};
