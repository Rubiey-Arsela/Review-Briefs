-- Al Bukhary Group entity/ownership map
-- Source: "20260907 - The Albukhary Group v2.pptx" (authoritative ownership deck,
-- supersedes the earlier Gen Team chat extraction). Percentages, holding chains
-- and relationship types (subsidiary/associate/jv) are as disclosed in that deck.

DELETE FROM entities;

-- ===================== Top-level controlled groups + strategic holdings =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('MMC Corporation', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, NULL, '["MMC Corporation Berhad", "MMC"]', 'Held 100% via Indra Cita -> Seaport Terminal (Johore), wholly owned by Tan Sri Syed Mokhtar Albukhary. Umbrella for Ports & cruise, Logistics & airport, Utilities & environment, Engineering & industrial land.'),
('Tradewinds Group (M)', 'Agriculture/Food Security', 'subsidiary', 100, NULL, '["Tradewinds Group (M) Sdn Bhd"]', 'Held 100% via Restu Jernih (essentially entire economic interest). Umbrella for Bernas, Tradewinds Plantation, Tradewinds Corporation, PNMB.'),
('DRB-HICOM', 'Automotive/Services', 'subsidiary', 55.92, NULL, '["DRB-HICOM Berhad"]', 'Legal/deemed interest 55.92% held through Etika Strategi (Tan Sri Syed Mokhtar 90%, spouse 10%); look-through economic interest ~50.33%. Umbrella for Proton, Pos Malaysia, Bank Muamalat, DEFTECH, CTRM.'),
('Media Prima', 'Other', 'associate', 31.9, NULL, '["Media Prima Berhad"]', '31.9% held via Aurora Mulia. Malaysia''s major commercial TV/digital/publishing/outdoor-media group — significant strategic position, NOT controlling.'),
('Eco World Development Group', 'Property', 'associate', 30.1, NULL, '["EcoWorld", "Eco World Development"]', '30.1% indirect via Syabas Tropikal -> Sinarmas Harta. Acquired May 2026. Major township/industrial/property developer.'),
('EWI Capital', 'Property', 'associate', 33.28, NULL, '["EWI Capital Berhad", "Eco World International"]', '33.28% indirect interest; formerly Eco World International. Legacy UK/Australia exposure. Arose from the May 2026 EcoWorld acquisition.'),
('MPH Group', 'Other', 'subsidiary', NULL, NULL, '["MPH Bookstores"]', 'Albukhary-controlled book retail/publishing group. Exact ultimate percentage not publicly disclosed — do not state a figure without an SSM extract.');

-- ===================== MMC Group: Ports & cruise =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('Port of Tanjung Pelepas', 'Ports/Infrastructure/Logistics', 'jv', 70, 'MMC Corporation', '["PTP", "Pelabuhan Tanjung Pelepas", "Tanjung Pelepas"]', 'Container transshipment port, Johor. 70% MMC, balance held by A.P. Moller-Maersk interests — a JV, not a wholly-owned subsidiary.'),
('Johor Port', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '["Johor Port Berhad"]', 'Multipurpose port — containers, bulk, conventional cargo.'),
('Northport', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '["Northport (Malaysia) Bhd"]', 'Major Port Klang container and conventional cargo terminal.'),
('Penang Port', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '["Penang Port Sdn Bhd"]', 'Main commercial seaport for northern Peninsular Malaysia.'),
('Andaman Port', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '["Yan Port STS"]', 'Offshore ship-to-ship terminal — crude oil, LNG, related cargo.'),
('Tanjung Bruas Port', 'Ports/Infrastructure/Logistics', 'jv', 70, 'MMC Corporation', '[]', 'Melaka multipurpose port.'),
('MMC Port Holdings', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '[]', NULL),
('NCB Holdings', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '[]', NULL),
('MMC Cruise Ports', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '[]', 'Swettenham Pier and Langkawi cruise terminals 100% each; Port Klang Cruise Terminal is a 50% JV.'),
('SPT Services', 'Ports/Infrastructure/Logistics', 'jv', 70, 'MMC Corporation', '[]', NULL);

-- ===================== MMC Group: Logistics & airport =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('Kontena Nasional', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '["Kontena Nasional Berhad"]', 'Haulage, freight forwarding, warehousing, integrated logistics.'),
('KN Global Logistics', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '[]', NULL),
('KN Global Transport', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '[]', NULL),
('KTMB MMC Cargo', 'Ports/Infrastructure/Logistics', 'jv', 49, 'MMC Corporation', '[]', 'Rail-freight JV with Malaysia''s national rail operator (KTMB) — 49% MMC, not a majority stake.'),
('JP Logistics', 'Ports/Infrastructure/Logistics', 'subsidiary', 100, 'MMC Corporation', '["JP Logistics Sdn Bhd"]', 'Johor Port-linked logistics business.'),
('Senai Airport Terminal Services', 'Aviation', 'subsidiary', 100, 'MMC Corporation', '["Senai Airport", "Senai International Airport"]', 'Owns/operates Senai International Airport; also operates Kertih Airport.');

-- ===================== MMC Group: Utilities & environment =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('Malakoff', 'Energy/Power/Sustainability', 'associate', 38.45, 'MMC Corporation', '["Malakoff Corporation Bhd"]', 'Major IPP and environmental services group — 38.45% ASSOCIATE, NOT a subsidiary. MMC is its major strategic shareholder, not sole owner.'),
('Alam Flora', 'Energy/Power/Sustainability', 'subsidiary', 97.37, 'Malakoff', '[]', 'Solid waste, public cleansing, recycling — held 97.37% by MALAKOFF (via MLK), NOT directly by MMC or DRB-HICOM. Common error: do not attribute to DRB-HICOM.'),
('Gas Malaysia', 'Energy/Power/Sustainability', 'associate', 30.9, 'MMC Corporation', '["Gas Malaysia Berhad"]', 'Natural-gas distribution and energy solutions — 30.9% ASSOCIATE, NOT a subsidiary.'),
('AIRB', 'Energy/Power/Sustainability', 'subsidiary', 100, 'MMC Corporation', '["Aliran Ihsan Resources", "Aliran Ihsan Resources Berhad"]', 'Water, wastewater and reclaimed-water treatment/infrastructure — 100% owned, NOT to be confused with "Air Selangor" (different entity; verify exact name before use).'),
('AB Aliran Ventures', 'Energy/Power/Sustainability', 'jv', 60, 'AIRB', '[]', 'Water and utilities venture — 60% AIRB.');

-- ===================== MMC Group: Engineering & industrial land =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('MMC Engineering Group', 'Ports/Infrastructure/Logistics', 'subsidiary', 77.67, 'MMC Corporation', '["MMC Engineering Group Bhd"]', 'Holding platform for engineering and infrastructure businesses.'),
('MMC-Gamuda JV', 'Ports/Infrastructure/Logistics', 'jv', 50, 'MMC Corporation', '[]', 'JV vehicles for MRT and other major infrastructure projects — 50/50 with Gamuda, a separate listed group (not an Al Bukhary entity).'),
('MMC Oil & Gas Engineering', 'Energy/Power/Sustainability', 'subsidiary', 100, 'MMC Corporation', '[]', NULL),
('MMC Land', 'Property', 'subsidiary', 100, 'MMC Corporation', '[]', 'Industrial land and property development platform. Industrial land bank ~5,300 acres group-wide.'),
('Senai Airport City', 'Property', 'subsidiary', 100, 'MMC Corporation', '["SAC"]', 'Industrial and business development beside Senai Airport. Expand abbreviation "SAC" on first use.'),
('Northern Technocity', 'Property', 'subsidiary', 100, 'MMC Corporation', '[]', 'High-tech industrial development in Kulim.'),
('Tanjung Bin Industrial Park', 'Property', 'subsidiary', 100, 'MMC Corporation', '["TBIP"]', 'Expand abbreviation "TBIP" on first use.');

-- ===================== Tradewinds Group: Rice, sugar & food =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('Bernas', 'Agriculture/Food Security', 'subsidiary', 100, 'Tradewinds Group (M)', '["Padiberas Nasional"]', 'Malaysia''s major rice/paddy procurement, processing, storage, import and distribution group — 100% owned (confirmed in the Dec-2025 Gardenia restructuring disclosure).'),
('Central Sugars Refinery', 'Agriculture/Food Security', 'subsidiary', 100, 'Bernas', '[]', 'Malaysia''s second-major refined-sugar producer — wholly owned by BERNAS.'),
('Gardenia Bakeries (KL)', 'Agriculture/Food Security', 'jv', 50, 'Tradewinds (M) Berhad', '[]', 'Major Malaysian bread/bakery business. Balance held by QAF/Gardenia Singapore. Dec-2025 restructuring moved the 50% interest from BERNAS to Tradewinds (M) — economically still a 50% Tradewinds JV.'),
('Jasmine Food Corporation', 'Agriculture/Food Security', 'subsidiary', 100, 'Tradewinds Group (M)', '[]', 'Rice processing, packaging and marketing, including Jasmine-branded rice.'),
('Era Bayam Kota', 'Agriculture/Food Security', 'subsidiary', 100, 'Jasmine Food Corporation', '[]', 'Rice and food distribution.');

-- ===================== Tradewinds Group: Plantations, hotels & property =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('Tradewinds (M) Berhad', 'Agriculture/Food Security', 'subsidiary', 100, 'Tradewinds Group (M)', '[]', 'Investment holding and group management services.'),
('Tradewinds Plantation', 'Agriculture/Food Security', 'subsidiary', NULL, 'Tradewinds Plantation Bhd', '["Tradewinds Plantation Bhd"]', 'Large oil-palm and plantation group — a controlled subsidiary; exact percentage not separately stated publicly. Do not confuse with Rimbunan Sawit or other peers.'),
('Tradewinds Corporation', 'Property', 'subsidiary', 100, NULL, '["Tradewinds Corporation Bhd", "TCB"]', 'Hotels, commercial property, property investment and development.'),
('Tradewinds Hotels & Resorts', 'Property', 'subsidiary', 100, 'Tradewinds Corporation', '["TCB Hotels"]', 'Owns/manages a major Malaysian hotel and resort portfolio — The Danna Langkawi, Rebak Island, Pelangi Beach, Tanjung Rhu, Mutiara Taman Negara, Glenmarie Golf & Country Club; Hilton-managed properties (Hilton PJ, Kuching, Shah Alam Glenmarie, Burau Bay Langkawi) sit within this portfolio.'),
('Avon Cosmetics Malaysia', 'Other', 'associate', 30, 'Tradewinds Corporation', '[]', 'Cosmetics and direct-selling business — a 30% TCB associate, not a subsidiary.'),
('Percetakan Nasional', 'Other', 'subsidiary', 100, 'Tradewinds Group (M)', '["PNMB"]', 'Government and commercial printing.'),
('Tradewinds International Insurance Broker', 'Banking/Financial Services', 'subsidiary', 100, 'Tradewinds Group (M)', '[]', NULL);

-- ===================== DRB-HICOM: Automotive & mobility =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('Proton', 'Automotive/Services', 'subsidiary', 50.10, 'DRB-HICOM', '["Proton Holdings Berhad", "PROTON"]', 'Malaysian national carmaker. DRB-HICOM 50.10%, Zhejiang Geely holds the balancing 49.90% as strategic JV partner — technically a controlled subsidiary but commercially behaves as a strategic JV. Every wholly-owned Proton subsidiary (Proton Edar, Tanjung Malim, e.MAS, Parts Centre, Global Services, PT Proton Edar Indonesia) flows through at 50.10%.'),
('Modenas', 'Automotive/Services', 'subsidiary', 70, 'DRB-HICOM', '[]', 'Malaysian motorcycle manufacturer.'),
('Honda Malaysia', 'Automotive/Services', 'associate', 34, 'DRB-HICOM', '[]', 'Honda vehicle assembly, distribution and sales — 34% associate.'),
('Mitsubishi Motors Malaysia', 'Automotive/Services', 'associate', 48, 'DRB-HICOM', '[]', '48% associate — Mitsubishi vehicle sales and distribution.'),
('Isuzu Malaysia', 'Automotive/Services', 'associate', 48.42, 'DRB-HICOM', '[]', '48.42% associate — Isuzu vehicle import, distribution and sales.'),
('Edaran Otomobil Nasional', 'Automotive/Services', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Major multi-brand automotive retail and distribution group.');

-- ===================== DRB-HICOM: Manufacturing & components =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('HICOM Engineering', 'Automotive/Services', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Automotive engineering and components platform.'),
('HICOM-Teck See Manufacturing', 'Automotive/Services', 'jv', 51, 'DRB-HICOM', '[]', 'Plastic automotive components — 51% JV.'),
('Isuzu HICOM Malaysia', 'Automotive/Services', 'jv', 49, 'DRB-HICOM', '[]', 'Isuzu commercial-vehicle manufacturing/assembly JV — 49%, not majority.');

-- ===================== DRB-HICOM: Aerospace, defence & services =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('DEFTECH', 'Automotive/Services', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Defence vehicles, systems integration and military technology — a major Malaysian defence contractor.'),
('CTRM Holdings', 'Automotive/Services', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Aerospace composites group supplying structures to major global aerospace OEMs.'),
('Pos Malaysia', 'Automotive/Services', 'subsidiary', 53.50, 'DRB-HICOM', '["Pos Malaysia Berhad"]', 'National postal, parcel and e-commerce logistics network — 53.50% (NOT held directly by MMC or the family; sits under DRB-HICOM). Pos Logistics/Pos Aviation, PNSL, Datapos, Pos Digicert, Pos Ar-Rahnu, Pos Shop each flow at 53.50%.'),
('Bank Muamalat', 'Banking/Financial Services', 'subsidiary', 70, 'DRB-HICOM', '["Bank Muamalat Malaysia"]', 'Full-service Islamic bank — 70% (sits under DRB-HICOM, not a direct family holding). Sukuk, financing-cost transmission channel.'),
('PUSPAKOM', 'Automotive/Services', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Mandatory and commercial vehicle inspection services.');

-- ===================== DRB-HICOM: Property =====================
INSERT OR IGNORE INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes) VALUES
('HICOM Berhad', 'Property', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Property and investment holding — property platform is effectively wholly owned, no minority partners.'),
('Glenmarie Properties', 'Property', 'subsidiary', 100, 'DRB-HICOM', '[]', NULL),
('Glenmarie Cove Development', 'Property', 'subsidiary', 100, 'DRB-HICOM', '[]', NULL),
('Proton City Development', 'Property', 'subsidiary', 100, 'DRB-HICOM', '[]', 'Development of the Proton City / Tanjung Malim land.');
