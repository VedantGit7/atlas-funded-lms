import { createTenantResourceRef } from "@atlas/authorization";
import type { TenantTx } from "@atlas/db";
import { itemNotFound, itemCollectionNotFound } from "./item-registry.errors";
import { itemRegistryRepository } from "./item-registry.repository";

type LoaderCtx = {
  tenantId: string;
  actorMembershipId: string;
};

export async function loadItemResourceRef(args: { tx: TenantTx; ctx: LoaderCtx; itemId: string }) {
  const item = await itemRegistryRepository.findItemById(args.tx, args.itemId);

  if (!item) {
    throw itemNotFound();
  }

  return createTenantResourceRef({
    type: "item",
    id: item.id,
    tenantId: args.ctx.tenantId,
    ownerMembershipId: item.created_by_membership_id ?? null,
  });
}

export async function loadItemCollectionResourceRef(args: {
  tx: TenantTx;
  ctx: LoaderCtx;
  collectionId: string;
}) {
  const collection = await itemRegistryRepository.findCollectionById(args.tx, args.collectionId);

  if (!collection) {
    throw itemCollectionNotFound();
  }

  return createTenantResourceRef({
    type: "item_collection",
    id: collection.id,
    tenantId: args.ctx.tenantId,
  });
}

export function loadItemCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "item",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadItemCreateResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "item",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadItemCollectionManageResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "item_collection",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadExtensionCatalogResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "extension_point",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}

export function loadExtensionRegistrationManageResourceRef(args: { ctx: LoaderCtx }) {
  return Promise.resolve(
    createTenantResourceRef({
      type: "extension_registration",
      id: args.ctx.tenantId,
      tenantId: args.ctx.tenantId,
    }),
  );
}
