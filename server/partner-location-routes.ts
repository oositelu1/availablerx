import { Router, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { insertPartnerLocationSchema } from "@shared/schema";
import { z } from "zod";

export const partnerLocationRouter = Router();

// Middleware to ensure user is authenticated
function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Not authenticated" });
}

// Middleware to ensure user is an admin
function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user?.role === "administrator") {
    return next();
  }
  return res.status(403).json({ error: "Admin access required" });
}

// Define typed request body
interface TypedRequestBody<T> extends Request {
  body: T;
}

// Create a new partner location
partnerLocationRouter.post(
  "/",
  isAuthenticated,
  async (
    req: TypedRequestBody<z.infer<typeof insertPartnerLocationSchema>>,
    res: Response
  ) => {
    try {
      // Validate the request body
      const validatedData = insertPartnerLocationSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });

      // Create the partner location
      const location = await storage.createPartnerLocation(validatedData);
      return res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating partner location:", error);
      return res.status(500).json({ error: "Failed to create partner location" });
    }
  }
);

// Get a specific partner location by ID
partnerLocationRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid location ID" });
    }
    
    const location = await storage.getPartnerLocation(id);
    if (!location) {
      return res.status(404).json({ error: "Partner location not found" });
    }
    
    return res.json(location);
  } catch (error) {
    console.error("Error getting partner location:", error);
    return res.status(500).json({ error: "Failed to get partner location" });
  }
});

// Update a partner location
partnerLocationRouter.patch("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid location ID" });
    }

    // Get the existing location
    const existingLocation = await storage.getPartnerLocation(id);
    if (!existingLocation) {
      return res.status(404).json({ error: "Partner location not found" });
    }
    
    // Update the location
    const updatedLocation = await storage.updatePartnerLocation(id, req.body);
    return res.json(updatedLocation);
  } catch (error) {
    console.error("Error updating partner location:", error);
    return res.status(500).json({ error: "Failed to update partner location" });
  }
});

// List all locations for a partner
partnerLocationRouter.get("/partner/:partnerId", async (req: Request, res: Response) => {
  try {
    const partnerId = parseInt(req.params.partnerId);
    if (isNaN(partnerId)) {
      return res.status(400).json({ error: "Invalid partner ID" });
    }
    
    // Check if location type filter is provided
    const locationType = req.query.type as string | undefined;
    
    const locations = await storage.listPartnerLocations(partnerId, locationType);
    return res.json(locations);
  } catch (error) {
    console.error("Error listing partner locations:", error);
    return res.status(500).json({ error: "Failed to list partner locations" });
  }
});

// Delete a partner location
partnerLocationRouter.delete("/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid location ID" });
    }
    
    const success = await storage.deletePartnerLocation(id);
    if (!success) {
      return res.status(404).json({ error: "Partner location not found or could not be deleted" });
    }
    
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting partner location:", error);
    return res.status(500).json({ error: "Failed to delete partner location" });
  }
});

// Set a location as the default for a location type (ship_from, ship_to, etc.)
partnerLocationRouter.post("/default/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid location ID" });
    }
    
    // Get the location to set as default
    const location = await storage.getPartnerLocation(id);
    if (!location) {
      return res.status(404).json({ error: "Partner location not found" });
    }
    
    // Find all other locations of the same type and set isDefault to false
    const partnerLocations = await storage.listPartnerLocations(location.partnerId, location.locationType);
    
    for (const otherLocation of partnerLocations) {
      if (otherLocation.id !== id && otherLocation.isDefault) {
        await storage.updatePartnerLocation(otherLocation.id, { isDefault: false });
      }
    }
    
    // Set the requested location as default
    const updatedLocation = await storage.updatePartnerLocation(id, { isDefault: true });
    return res.json(updatedLocation);
  } catch (error) {
    console.error("Error setting default location:", error);
    return res.status(500).json({ error: "Failed to set default location" });
  }
});