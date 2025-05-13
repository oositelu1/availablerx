import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User table schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("operator"), // operator or administrator
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true, 
  createdAt: true
});

// Trading partner schema
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  partnerType: text("partner_type").notNull(),
  contactEmail: text("contact_email").notNull(),
  notes: text("notes"),
  endpointUrl: text("endpoint_url"),
  as2Id: text("as2_id"),
  certificate: text("certificate"),
  authToken: text("auth_token"),
  transportType: text("transport_type").default("AS2"), // AS2 or HTTPS
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull(), // references users.id
});

export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true
});

// EPCIS files schema
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storagePath: text("storage_path").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(), // ZIP or XML
  sha256: text("sha256").notNull(),
  status: text("status").notNull(), // validated, failed, sending, sent
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Store extracted metadata like event counts, sender GLN, etc.
  uploadedBy: integer("uploaded_by").notNull(), // references users.id
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  uploadedAt: true
});

// File transmissions schema
export const transmissions = pgTable("transmissions", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").notNull(), // references files.id
  partnerId: integer("partner_id").notNull(), // references partners.id
  status: text("status").notNull(), // queued, sent, failed, retrying
  transportType: text("transport_type").notNull(), // AS2 or HTTPS
  sentBy: integer("sent_by").notNull(), // references users.id
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveryConfirmation: text("delivery_confirmation"), // Store MDN or HTTP response
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
});

export const insertTransmissionSchema = createInsertSchema(transmissions).omit({
  id: true,
  sentAt: true,
  retryCount: true,
  nextRetryAt: true
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type Transmission = typeof transmissions.$inferSelect;
export type InsertTransmission = z.infer<typeof insertTransmissionSchema>;

// Pre-signed URL links for partner file sharing
export const presignedLinks = pgTable("presigned_links", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull(),
  fileId: integer("file_id").notNull().references(() => files.id),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  urlHash: text("url_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  firstClickedAt: timestamp("first_clicked_at"),
  downloadedAt: timestamp("downloaded_at"),
  isOneTimeUse: boolean("is_one_time_use").notNull().default(false),
  ipRestriction: text("ip_restriction"),
  createdBy: integer("created_by").notNull().references(() => users.id),
});

export const insertPresignedLinkSchema = createInsertSchema(presignedLinks);

export type PresignedLink = typeof presignedLinks.$inferSelect;
export type InsertPresignedLink = z.infer<typeof insertPresignedLinkSchema>;
