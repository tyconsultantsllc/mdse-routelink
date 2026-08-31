-- Seed initial pharmacies (Orange County, CA)

INSERT INTO public.pharmacies (id, name, address, phone, email, latitude, longitude) VALUES
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'CVS Pharmacy - Santa Ana', '1234 Main St, Santa Ana, CA 92701', '(714) 555-0101', 'santaana@cvs.com', 33.7454, -117.8678),
  ('b2c3d4e5-f6a7-4b5c-8d9e-1f2a3b4c5d6e', 'Walgreens - Irvine', '5678 University Dr, Irvine, CA 92612', '(949) 555-0202', 'irvine@walgreens.com', 33.6783, -117.8231),
  ('c3d4e5f6-a7b8-4c5d-9e0f-2a3b4c5d6e7f', 'Rite Aid - Anaheim', '9101 Harbor Blvd, Anaheim, CA 92804', '(714) 555-0303', 'anaheim@riteaid.com', 33.8366, -117.9143),
  ('d4e5f6a7-b8c9-4d5e-0f1a-3b4c5d6e7f8a', 'CVS Pharmacy - Orange', '2345 Chapman Ave, Orange, CA 92866', '(714) 555-0404', 'orange@cvs.com', 33.7879, -117.8531),
  ('e5f6a7b8-c9d0-4e5f-1a2b-4c5d6e7f8a9b', 'Costco Pharmacy - Tustin', '1500 El Camino Real, Tustin, CA 92780', '(714) 555-0505', 'tustin@costco.com', 33.7320, -117.8148)
ON CONFLICT (id) DO NOTHING;
