-- Al Bukhary Group entity/ownership map (from Team WBR house rules)
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('MMC Ports', 'Ports/Infrastructure/Logistics', 'subsidiary', NULL, 'MMC Corporation', '["MMC Port Holdings"]', 'Umbrella for PTP, Johor Port, Northport, Penang Port'),
('Port of Tanjung Pelepas', 'Ports/Infrastructure/Logistics', 'subsidiary', NULL, 'MMC Ports', '["PTP", "Tanjung Pelepas"]', NULL),
('Johor Port', 'Ports/Infrastructure/Logistics', 'subsidiary', NULL, 'MMC Ports', '[]', NULL),
('Northport', 'Ports/Infrastructure/Logistics', 'subsidiary', NULL, 'MMC Ports', '[]', NULL),
('Penang Port', 'Ports/Infrastructure/Logistics', 'subsidiary', NULL, 'MMC Ports', '[]', NULL),
('Kontena Nasional', 'Ports/Infrastructure/Logistics', 'subsidiary', NULL, 'MMC Corporation', '[]', NULL),
('DRB-HICOM', 'Automotive/Services', 'subsidiary', NULL, NULL, '[]', 'Also has property, defence, aerospace arms'),
('Proton', 'Automotive/Services', 'subsidiary', NULL, 'DRB-HICOM', '[]', NULL),
('Pos Malaysia', 'Automotive/Services', 'subsidiary', NULL, 'DRB-HICOM', '[]', 'Also logistics'),
('Malakoff', 'Energy/Power/Sustainability', 'associate', 38.45, 'MMC Corporation', '[]', '38.45% associate — NOT wholly owned, never call it a subsidiary'),
('Gas Malaysia', 'Energy/Power/Sustainability', 'associate', 30.9, 'MMC Corporation', '[]', '30.9% associate — NOT wholly owned'),
('AIRB', 'Energy/Power/Sustainability', 'subsidiary', NULL, NULL, '["Air Selangor"]', 'Water infrastructure — verify exact name before use'),
('Bernas', 'Agriculture/Food Security', 'subsidiary', NULL, NULL, '["Padiberas Nasional"]', 'Rice — padi/rice value chain'),
('Tradewinds Plantation', 'Agriculture/Food Security', 'subsidiary', NULL, 'Tradewinds Corporation', '[]', 'Do not confuse with Rimbunan Sawit or other peers'),
('Tradewinds Corporation', 'Agriculture/Food Security', 'subsidiary', NULL, NULL, '[]', NULL),
('MMC Land', 'Property', 'subsidiary', NULL, 'MMC Corporation', '[]', NULL),
('Tanjung Bin Industrial Park', 'Property', 'subsidiary', NULL, 'MMC Corporation', '["TBIP"]', 'Expand abbreviation on first use'),
('Senai Airport City', 'Property', 'subsidiary', NULL, 'MMC Corporation', '["SAC"]', 'Expand abbreviation on first use'),
('Bank Muamalat', 'Banking/Financial Services', 'subsidiary', NULL, NULL, '[]', 'Islamic bank — sukuk, financing cost transmission channel'),
('Senai Airport', 'Aviation', 'subsidiary', NULL, 'MMC Corporation', '[]', NULL);

-- Banned/weak words list is enforced in application logic (see src/lib/compliance.ts),
-- kept in code rather than DB since it changes rarely and needs pattern matching.
