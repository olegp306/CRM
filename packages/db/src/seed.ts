import { prisma } from "./client";
import { createDemoSeedData } from "./seed-data";

async function main() {
  const seed = createDemoSeedData();

  const workspace = await prisma.workspace.upsert({
    where: { id: seed.workspace.id },
    update: {
      name: seed.workspace.name,
      brandName: seed.workspace.brandName,
      primaryColor: seed.workspace.primaryColor
    },
    create: seed.workspace
  });

  const owner = await prisma.user.upsert({
    where: { id: seed.owner.id },
    update: { email: seed.owner.email, name: seed.owner.name },
    create: seed.owner
  });

  await prisma.workspaceMembership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: owner.id } },
    update: { role: "owner" },
    create: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner"
    }
  });

  await prisma.project.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.outreachTouch.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.coldTarget.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.lead.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.client.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.priceTableRow.deleteMany({ where: { workspaceId: workspace.id } });

  await prisma.priceTableRow.createMany({
    data: seed.priceTableRows.map((row) => ({
      workspaceId: workspace.id,
      ...row
    }))
  });

  const clients = await Promise.all(
    seed.clients.map((client) =>
      prisma.client.create({
        data: {
          workspaceId: workspace.id,
          ...client
        }
      })
    )
  );

  const leads = await Promise.all(
    seed.leads.map((lead, index) =>
      prisma.lead.create({
        data: {
          workspaceId: workspace.id,
          clientRecordId: clients[index]?.id,
          ...lead
        }
      })
    )
  );

  await Promise.all(
    seed.projects.map((project) =>
      prisma.project.create({
        data: {
          workspaceId: workspace.id,
          clientRecordId: clients[0]?.id,
          leadRecordId: leads[0]?.id,
          ...project
        }
      })
    )
  );

  await prisma.coldTarget.createMany({
    data: seed.coldTargets.map((target) => ({
      workspaceId: workspace.id,
      targetId: target.targetId,
      companyName: target.companyName,
      website: target.website,
      region: target.region,
      address: target.address,
      contactPerson: target.contactPerson,
      contactRole: target.contactRole,
      email: target.email,
      phone: target.phone,
      linkedinUrl: target.linkedinUrl,
      fitScore: target.fitScore,
      priority: target.priority,
      notesResearch: target.notesResearch,
      currentTouch: 1
    }))
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
