import { Router, Request, Response } from "express";
import { storage } from "./storage";

export const salesOrderRouter = Router();

// Middleware to check if user is authenticated
salesOrderRouter.use((req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
});

// Get all sales orders
salesOrderRouter.get("/", async (req: Request, res: Response) => {
  try {
    // For demo, return mock sales orders
    const orders = [
      {
        id: 1,
        soNumber: 'SO-2025-001',
        orderDate: '2025-05-10',
        customerId: 3,
        customerName: 'Memorial Hospital',
        status: 'pending',
        totalItems: 12,
        shipToLocation: 'Memorial Hospital Pharmacy, 123 Main St, New York, NY'
      },
      {
        id: 2,
        soNumber: 'SO-2025-002',
        orderDate: '2025-05-14',
        customerId: 4,
        customerName: 'University Medical Center',
        status: 'approved',
        totalItems: 24,
        shipToLocation: 'UMC Pharmacy, 456 University Ave, San Francisco, CA'
      },
      {
        id: 3,
        soNumber: 'SO-2025-003',
        orderDate: '2025-05-18',
        customerId: 5,
        customerName: 'Cedar-Sinai Medical',
        status: 'pending',
        totalItems: 8,
        shipToLocation: 'Cedar-Sinai Pharmacy, 789 Cedar Blvd, Los Angeles, CA'
      }
    ];
    
    res.json({ orders });
  } catch (error: any) {
    console.error("Error fetching sales orders:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single sales order
salesOrderRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sales order ID" });
    }
    
    // Mock sales order data
    const mockOrders = {
      1: {
        id: 1,
        soNumber: 'SO-2025-001',
        orderDate: '2025-05-10',
        customerId: 3,
        customerName: 'Memorial Hospital',
        status: 'pending',
        totalItems: 12,
        shipToLocation: 'Memorial Hospital Pharmacy, 123 Main St, New York, NY',
        items: [
          {
            id: 101,
            soId: 1,
            lineNumber: 1,
            gtin: '00301430957010',
            productName: 'SODIUM FERRIC GLUCONATE',
            ndc: '30143095701',
            packageType: 'item',
            packageSize: '1 x 125 mg/10 mL',
            manufacturer: 'WEST-WARD PHARMACEUTICALS',
            quantity: 5,
            lotNumber: '24052241',
            expirationDate: '2026-09-30',
            unitPrice: 149.99,
            status: 'pending'
          },
          {
            id: 102,
            soId: 1,
            lineNumber: 2,
            gtin: '10395487401027',
            productName: 'HEPARIN SODIUM',
            ndc: '39548740102',
            packageType: 'item',
            packageSize: '1 x 10,000 USP units/10 mL',
            manufacturer: 'APP PHARMACEUTICALS',
            quantity: 7,
            lotNumber: '24081501',
            expirationDate: '2026-08-15',
            unitPrice: 89.99,
            status: 'pending'
          }
        ]
      },
      2: {
        id: 2,
        soNumber: 'SO-2025-002',
        orderDate: '2025-05-14',
        customerId: 4,
        customerName: 'University Medical Center',
        status: 'approved',
        totalItems: 24,
        shipToLocation: 'UMC Pharmacy, 456 University Ave, San Francisco, CA',
        items: [
          {
            id: 201,
            soId: 2,
            lineNumber: 1,
            gtin: '00301430957010',
            productName: 'SODIUM FERRIC GLUCONATE',
            ndc: '30143095701',
            packageType: 'item',
            packageSize: '1 x 125 mg/10 mL',
            manufacturer: 'WEST-WARD PHARMACEUTICALS',
            quantity: 24,
            lotNumber: '24052241',
            expirationDate: '2026-09-30',
            unitPrice: 149.99,
            status: 'approved'
          }
        ]
      }
    };
    
    const order = mockOrders[id];
    if (!order) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    
    res.json(order);
  } catch (error: any) {
    console.error("Error fetching sales order:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get items for a sales order
salesOrderRouter.get("/:id/items", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid sales order ID" });
    }
    
    // Mock items data
    const mockItems = {
      1: [
        {
          id: 101,
          soId: 1,
          lineNumber: 1,
          gtin: '00301430957010',
          productName: 'SODIUM FERRIC GLUCONATE',
          ndc: '30143095701',
          packageType: 'item',
          packageSize: '1 x 125 mg/10 mL',
          manufacturer: 'WEST-WARD PHARMACEUTICALS',
          quantity: 5,
          lotNumber: '24052241',
          expirationDate: '2026-09-30',
          unitPrice: 149.99,
          status: 'pending'
        },
        {
          id: 102,
          soId: 1,
          lineNumber: 2,
          gtin: '10395487401027',
          productName: 'HEPARIN SODIUM',
          ndc: '39548740102',
          packageType: 'item',
          packageSize: '1 x 10,000 USP units/10 mL',
          manufacturer: 'APP PHARMACEUTICALS',
          quantity: 7,
          lotNumber: '24081501',
          expirationDate: '2026-08-15',
          unitPrice: 89.99,
          status: 'pending'
        }
      ],
      2: [
        {
          id: 201,
          soId: 2,
          lineNumber: 1,
          gtin: '00301430957010',
          productName: 'SODIUM FERRIC GLUCONATE',
          ndc: '30143095701',
          packageType: 'item',
          packageSize: '1 x 125 mg/10 mL',
          manufacturer: 'WEST-WARD PHARMACEUTICALS',
          quantity: 24,
          lotNumber: '24052241',
          expirationDate: '2026-09-30',
          unitPrice: 149.99,
          status: 'approved'
        }
      ]
    };
    
    const items = mockItems[id];
    if (!items) {
      return res.status(404).json({ message: "Sales order items not found" });
    }
    
    res.json({ items });
  } catch (error: any) {
    console.error("Error fetching sales order items:", error);
    res.status(500).json({ message: error.message });
  }
});