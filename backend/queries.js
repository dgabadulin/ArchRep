module.exports = {
    systems_select: `
        SELECT
          s.id
        , s.code
        ,  s.name
        , s.fullname
        , parent.name AS parent_name
        , ss.name as status
        , vnd.name vendor
        , supl.name supplier
        , supp.name supporter
        , s.description
        , so.name owner
        , sht.name hosting
        , s.comment
        , s.technologies
        , s.external_system
        , s.parent_ar_systems_id
        , s.ar_system_statuses_id
        , s.vendor_ar_partners_id
        , s.supplier_ar_partners_id
        , s.supporter_ar_partners_id
        , s.ar_system_owners_id
        , s.ar_system_hosting_types_id
        , s.it_lead_employee_id
        , s.business_lead_employee_id
        , it_e.full_name AS it_lead_employee_name
        , bl_e.full_name AS business_lead_employee_name
        FROM
        archrep.ar_systems s
        LEFT JOIN archrep.ar_systems parent ON parent.id = s.parent_ar_systems_id
        LEFT JOIN archrep.ar_system_statuses ss ON s.ar_system_statuses_id = ss.id
        LEFT JOIN archrep.ar_partners vnd ON s.vendor_ar_partners_id = vnd.id
        LEFT JOIN archrep.ar_partners supl ON s.supplier_ar_partners_id = supl.id
        LEFT JOIN archrep.ar_partners supp ON s.supporter_ar_partners_id = supp.id
        LEFT JOIN archrep.ar_system_owners so ON s.ar_system_owners_id = so.id
        LEFT JOIN archrep.ar_system_hosting_types sht ON s.ar_system_hosting_types_id = sht.id
        LEFT JOIN archrep.ar_employees it_e ON s.it_lead_employee_id = it_e.id
        LEFT JOIN archrep.ar_employees bl_e ON s.business_lead_employee_id = bl_e.id
        order by s.name
    `,
    systems_select_search: `
        SELECT
          s.id, s.code, s.name, s.fullname, parent.name AS parent_name, ss.name as status,
          vnd.name vendor, supl.name supplier, supp.name supporter, s.description,
          so.name owner, sht.name hosting, s.comment, s.technologies, s.external_system,
          s.parent_ar_systems_id, s.ar_system_statuses_id, s.vendor_ar_partners_id, s.supplier_ar_partners_id,
          s.supporter_ar_partners_id, s.ar_system_owners_id, s.ar_system_hosting_types_id,
          s.it_lead_employee_id, s.business_lead_employee_id,
          it_e.full_name AS it_lead_employee_name, bl_e.full_name AS business_lead_employee_name
        FROM archrep.ar_systems s
        LEFT JOIN archrep.ar_systems parent ON parent.id = s.parent_ar_systems_id
        LEFT JOIN archrep.ar_system_statuses ss ON s.ar_system_statuses_id = ss.id
        LEFT JOIN archrep.ar_partners vnd ON s.vendor_ar_partners_id = vnd.id
        LEFT JOIN archrep.ar_partners supl ON s.supplier_ar_partners_id = supl.id
        LEFT JOIN archrep.ar_partners supp ON s.supporter_ar_partners_id = supp.id
        LEFT JOIN archrep.ar_system_owners so ON s.ar_system_owners_id = so.id
        LEFT JOIN archrep.ar_system_hosting_types sht ON s.ar_system_hosting_types_id = sht.id
        LEFT JOIN archrep.ar_employees it_e ON s.it_lead_employee_id = it_e.id
        LEFT JOIN archrep.ar_employees bl_e ON s.business_lead_employee_id = bl_e.id
        WHERE (s.code ILIKE $1 OR s.name ILIKE $1 OR COALESCE(s.fullname,'') ILIKE $1 OR COALESCE(parent.name,'') ILIKE $1
          OR COALESCE(ss.name,'') ILIKE $1 OR COALESCE(vnd.name,'') ILIKE $1 OR COALESCE(supl.name,'') ILIKE $1
          OR COALESCE(supp.name,'') ILIKE $1 OR COALESCE(s.description,'') ILIKE $1 OR COALESCE(so.name,'') ILIKE $1 OR COALESCE(sht.name,'') ILIKE $1
          OR COALESCE(s.comment,'') ILIKE $1 OR COALESCE(s.technologies,'') ILIKE $1
          OR COALESCE(it_e.full_name,'') ILIKE $1 OR COALESCE(bl_e.full_name,'') ILIKE $1)
        ORDER BY s.name
    `,
    systems_get: `
        SELECT s.id, s.code, s.name, s.fullname, parent.name AS parent_name, ss.name as status,
          vnd.name vendor, supl.name supplier, supp.name supporter, s.description,
          so.name owner, sht.name hosting, s.comment, s.technologies, s.external_system,
          s.parent_ar_systems_id, s.ar_system_statuses_id, s.vendor_ar_partners_id, s.supplier_ar_partners_id,
          s.supporter_ar_partners_id, s.ar_system_owners_id, s.ar_system_hosting_types_id,
          s.it_lead_employee_id, s.business_lead_employee_id,
          it_e.full_name AS it_lead_employee_name, bl_e.full_name AS business_lead_employee_name
        FROM archrep.ar_systems s
        LEFT JOIN archrep.ar_systems parent ON parent.id = s.parent_ar_systems_id
        LEFT JOIN archrep.ar_system_statuses ss ON s.ar_system_statuses_id = ss.id
        LEFT JOIN archrep.ar_partners vnd ON s.vendor_ar_partners_id = vnd.id
        LEFT JOIN archrep.ar_partners supl ON s.supplier_ar_partners_id = supl.id
        LEFT JOIN archrep.ar_partners supp ON s.supporter_ar_partners_id = supp.id
        LEFT JOIN archrep.ar_system_owners so ON s.ar_system_owners_id = so.id
        LEFT JOIN archrep.ar_system_hosting_types sht ON s.ar_system_hosting_types_id = sht.id
        LEFT JOIN archrep.ar_employees it_e ON s.it_lead_employee_id = it_e.id
        LEFT JOIN archrep.ar_employees bl_e ON s.business_lead_employee_id = bl_e.id
        WHERE s.id = $1
    `,
    systems_get_by_code: `
        SELECT s.id, s.code, s.name, s.fullname, parent.name AS parent_name, ss.name as status,
          vnd.name vendor, supl.name supplier, supp.name supporter, s.description,
          so.name owner, sht.name hosting, s.comment, s.technologies, s.external_system,
          s.parent_ar_systems_id, s.ar_system_statuses_id, s.vendor_ar_partners_id, s.supplier_ar_partners_id,
          s.supporter_ar_partners_id, s.ar_system_owners_id, s.ar_system_hosting_types_id,
          s.it_lead_employee_id, s.business_lead_employee_id,
          it_e.full_name AS it_lead_employee_name, bl_e.full_name AS business_lead_employee_name
        FROM archrep.ar_systems s
        LEFT JOIN archrep.ar_systems parent ON parent.id = s.parent_ar_systems_id
        LEFT JOIN archrep.ar_system_statuses ss ON s.ar_system_statuses_id = ss.id
        LEFT JOIN archrep.ar_partners vnd ON s.vendor_ar_partners_id = vnd.id
        LEFT JOIN archrep.ar_partners supl ON s.supplier_ar_partners_id = supl.id
        LEFT JOIN archrep.ar_partners supp ON s.supporter_ar_partners_id = supp.id
        LEFT JOIN archrep.ar_system_owners so ON s.ar_system_owners_id = so.id
        LEFT JOIN archrep.ar_system_hosting_types sht ON s.ar_system_hosting_types_id = sht.id
        LEFT JOIN archrep.ar_employees it_e ON s.it_lead_employee_id = it_e.id
        LEFT JOIN archrep.ar_employees bl_e ON s.business_lead_employee_id = bl_e.id
        WHERE s.code = $1
    `,
    parent_systems_select: `
    SELECT
      s.id
    , s.name
    FROM
      archrep.ar_systems s
    WHERE s.parent_ar_systems_id is null
    order by s.name
    `,
    vendors_select: `
      SELECT
        id
      , name
      FROM
        archrep.ar_partners
      ORDER BY
        name
    `,
    owners_select: `
    SELECT
      id
    , name
    FROM
      archrep.ar_system_owners
    ORDER BY
      name
  `,
    system_statuses_select: `
      SELECT
        id
      , name
      , description
      FROM
          archrep.ar_system_statuses
      ORDER BY
          id
    `,
    system_hosting_types_select: `
      SELECT
        id
      , name
      FROM
          archrep.ar_system_hosting_types
      ORDER BY
          name
    `,
    systems_update: `
    UPDATE
      archrep.ar_systems
    SET
      code = $1,
      name = $2,
      fullname = $3,
      parent_ar_systems_id = NULLIF($4, '')::BIGINT,
      ar_system_statuses_id = NULLIF($5, '')::BIGINT,
      vendor_ar_partners_id = NULLIF($6, '')::BIGINT,
      supplier_ar_partners_id = NULLIF($7, '')::BIGINT,
      supporter_ar_partners_id = NULLIF($8, '')::BIGINT,
      description = $9,
      ar_system_hosting_types_id = NULLIF($10, '')::BIGINT,
      technologies = COALESCE($11, ''),
      external_system = COALESCE($12, false),
      comment = $13,
      it_lead_employee_id = NULLIF($14, '')::BIGINT,
      business_lead_employee_id = NULLIF($15, '')::BIGINT
    WHERE id = $16
    RETURNING *
  `,
  systems_insert:`
  INSERT INTO archrep.ar_systems (
    code,
    "name",
    fullname,
    parent_ar_systems_id,
    ar_system_statuses_id,
    vendor_ar_partners_id,
    supplier_ar_partners_id,
    supporter_ar_partners_id,
    description,
    ar_system_hosting_types_id,
    technologies,
    external_system,
    comment,
    it_lead_employee_id,
    business_lead_employee_id
  ) VALUES (
    $1, $2, $3, NULLIF($4, '')::BIGINT, NULLIF($5, '')::BIGINT,
    NULLIF($6, '')::BIGINT, NULLIF($7, '')::BIGINT, NULLIF($8, '')::BIGINT,
    $9, NULLIF($10, '')::BIGINT, $11,
    COALESCE($12, false),
    $13,
    NULLIF($14, '')::BIGINT,
    NULLIF($15, '')::BIGINT
  )
  RETURNING id
`,
  // --- Partners (ar_partners) ---
  partners_select: `SELECT id, name FROM archrep.ar_partners ORDER BY name`,
  partners_select_search: `SELECT id, name FROM archrep.ar_partners WHERE name ILIKE $1 ORDER BY name`,
  partners_insert: `INSERT INTO archrep.ar_partners (name) VALUES ($1) RETURNING *`,
  partners_update: `UPDATE archrep.ar_partners SET name = $1 WHERE id = $2 RETURNING *`,
  partners_delete: `DELETE FROM archrep.ar_partners WHERE id = $1`,
  partners_get: `SELECT id, name FROM archrep.ar_partners WHERE id = $1`,

  // --- Employees (ar_employees) ---
  employees_select: `
    SELECT id, employee_number, full_name, email, active,
           CASE WHEN active THEN 'active' ELSE 'inactive' END AS status
    FROM archrep.ar_employees ORDER BY full_name`,
  employees_select_search: `
    SELECT id, employee_number, full_name, email, active,
           CASE WHEN active THEN 'active' ELSE 'inactive' END AS status
    FROM archrep.ar_employees
    WHERE full_name ILIKE $1
       OR split_part(full_name, ' ', 1) ILIKE $1
       OR COALESCE(employee_number, '') ILIKE $1
       OR COALESCE(email, '') ILIKE $1
    ORDER BY full_name`,
  employees_get: `
    SELECT id, employee_number, full_name, email, active,
           CASE WHEN active THEN 'active' ELSE 'inactive' END AS status
    FROM archrep.ar_employees WHERE id = $1`,
  employees_insert: `
    INSERT INTO archrep.ar_employees (employee_number, full_name, email, active)
    VALUES (NULLIF(trim($1), ''), $2, NULLIF(lower(trim($3)), ''), COALESCE($4, true))
    RETURNING id, employee_number, full_name, email, active,
      CASE WHEN active THEN 'active' ELSE 'inactive' END AS status`,
  employees_update: `
    UPDATE archrep.ar_employees
    SET employee_number = NULLIF(trim($1), ''),
        full_name = $2,
        email = NULLIF(lower(trim($3)), ''),
        active = COALESCE($4, active),
        updated_at = current_timestamp
    WHERE id = $5
    RETURNING id, employee_number, full_name, email, active,
      CASE WHEN active THEN 'active' ELSE 'inactive' END AS status`,
  employees_delete: `DELETE FROM archrep.ar_employees WHERE id = $1`,

  owners_select: `SELECT id, name, leader FROM archrep.ar_system_owners ORDER BY name`,
  owners_select_search: `SELECT id, name, leader FROM archrep.ar_system_owners WHERE name ILIKE $1 OR COALESCE(leader,'') ILIKE $1 ORDER BY name`,
  owners_insert: `INSERT INTO archrep.ar_system_owners (name, leader) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  owners_update: `UPDATE archrep.ar_system_owners SET name = $1, leader = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  owners_delete: `DELETE FROM archrep.ar_system_owners WHERE id = $1`,
  owners_get: `SELECT id, name, leader FROM archrep.ar_system_owners WHERE id = $1`,

  system_statuses_select: `SELECT id, name, description FROM archrep.ar_system_statuses ORDER BY id`,
  system_statuses_select_search: `SELECT id, name, description FROM archrep.ar_system_statuses WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY id`,
  system_statuses_insert: `INSERT INTO archrep.ar_system_statuses (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  system_statuses_update: `UPDATE archrep.ar_system_statuses SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  system_statuses_delete: `DELETE FROM archrep.ar_system_statuses WHERE id = $1`,
  system_statuses_get: `SELECT id, name, description FROM archrep.ar_system_statuses WHERE id = $1`,

  hosting_types_select: `SELECT id, name FROM archrep.ar_system_hosting_types ORDER BY name`,
  hosting_types_select_search: `SELECT id, name FROM archrep.ar_system_hosting_types WHERE name ILIKE $1 ORDER BY name`,
  hosting_types_insert: `INSERT INTO archrep.ar_system_hosting_types (name) VALUES ($1) RETURNING *`,
  hosting_types_update: `UPDATE archrep.ar_system_hosting_types SET name = $1 WHERE id = $2 RETURNING *`,
  hosting_types_delete: `DELETE FROM archrep.ar_system_hosting_types WHERE id = $1`,
  hosting_types_get: `SELECT id, name FROM archrep.ar_system_hosting_types WHERE id = $1`,

  // --- Technologies ---
  technologies_select: `
    SELECT t.id, t.name, t.vendor_ar_partners_id, t.technology_classes_id, t.approve_document,
           t.technology_types_id, t.technology_statuses_id, t.radar_include_flag, t.description, t.domestic_flag,
           v.name as vendor_name, tc.name as technology_class_name, tt.name as technology_type_name, ts.name as technology_status_name
    FROM archrep.ar_technologies t
    LEFT JOIN archrep.ar_partners v ON t.vendor_ar_partners_id = v.id
    LEFT JOIN archrep.ar_technology_classes tc ON t.technology_classes_id = tc.id
    LEFT JOIN archrep.ar_technology_types tt ON t.technology_types_id = tt.id
    LEFT JOIN archrep.ar_technology_statuses ts ON t.technology_statuses_id = ts.id
    ORDER BY t.name`,
  technologies_select_search: `
    SELECT t.id, t.name, t.vendor_ar_partners_id, t.technology_classes_id, t.approve_document,
           t.technology_types_id, t.technology_statuses_id, t.radar_include_flag, t.description, t.domestic_flag,
           v.name as vendor_name, tc.name as technology_class_name, tt.name as technology_type_name, ts.name as technology_status_name
    FROM archrep.ar_technologies t
    LEFT JOIN archrep.ar_partners v ON t.vendor_ar_partners_id = v.id
    LEFT JOIN archrep.ar_technology_classes tc ON t.technology_classes_id = tc.id
    LEFT JOIN archrep.ar_technology_types tt ON t.technology_types_id = tt.id
    LEFT JOIN archrep.ar_technology_statuses ts ON t.technology_statuses_id = ts.id
    WHERE (t.name ILIKE $1 OR COALESCE(t.description,'') ILIKE $1 OR COALESCE(t.approve_document,'') ILIKE $1
      OR COALESCE(v.name,'') ILIKE $1 OR COALESCE(tc.name,'') ILIKE $1 OR COALESCE(tt.name,'') ILIKE $1 OR COALESCE(ts.name,'') ILIKE $1)
    ORDER BY t.name`,
  technologies_get: `SELECT * FROM archrep.ar_technologies WHERE id = $1`,
  technologies_insert: `INSERT INTO archrep.ar_technologies (name, vendor_ar_partners_id, technology_classes_id, approve_document, technology_types_id, technology_statuses_id, radar_include_flag, description, domestic_flag)
    VALUES ($1, NULLIF($2,'')::BIGINT, NULLIF($3,'')::BIGINT, NULLIF($4,''), NULLIF($5,'')::BIGINT, NULLIF($6,'')::BIGINT, $7, NULLIF($8,''), $9) RETURNING *`,
  technologies_update: `UPDATE archrep.ar_technologies SET name=$1, vendor_ar_partners_id=NULLIF($2,'')::BIGINT, technology_classes_id=NULLIF($3,'')::BIGINT, approve_document=NULLIF($4,''), technology_types_id=NULLIF($5,'')::BIGINT, technology_statuses_id=NULLIF($6,'')::BIGINT, radar_include_flag=$7, description=NULLIF($8,''), domestic_flag=$9 WHERE id=$10 RETURNING *`,
  technologies_delete: `DELETE FROM archrep.ar_technologies WHERE id = $1`,
  technologies_get_by_name: `
    SELECT t.*, v.name as vendor_name, tc.name as technology_class_name, tt.name as technology_type_name, ts.name as technology_status_name
    FROM archrep.ar_technologies t
    LEFT JOIN archrep.ar_partners v ON t.vendor_ar_partners_id = v.id
    LEFT JOIN archrep.ar_technology_classes tc ON t.technology_classes_id = tc.id
    LEFT JOIN archrep.ar_technology_types tt ON t.technology_types_id = tt.id
    LEFT JOIN archrep.ar_technology_statuses ts ON t.technology_statuses_id = ts.id
    WHERE lower(trim(t.name)) = lower(trim($1))
    LIMIT 1`,

  technology_classes_select: `SELECT id, name, description FROM archrep.ar_technology_classes ORDER BY name`,
  technology_classes_select_search: `SELECT id, name, description FROM archrep.ar_technology_classes WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY name`,
  technology_classes_insert: `INSERT INTO archrep.ar_technology_classes (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  technology_classes_update: `UPDATE archrep.ar_technology_classes SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  technology_classes_delete: `DELETE FROM archrep.ar_technology_classes WHERE id = $1`,

  technology_statuses_select: `SELECT id, name, fullname, description FROM archrep.ar_technology_statuses ORDER BY name`,
  technology_statuses_select_search: `SELECT id, name, fullname, description FROM archrep.ar_technology_statuses WHERE name ILIKE $1 OR fullname ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY name`,
  technology_statuses_insert: `INSERT INTO archrep.ar_technology_statuses (name, fullname, description) VALUES ($1, $2, NULLIF($3,'')) RETURNING *`,
  technology_statuses_update: `UPDATE archrep.ar_technology_statuses SET name = $1, fullname = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  technology_statuses_delete: `DELETE FROM archrep.ar_technology_statuses WHERE id = $1`,

  technology_types_select: `SELECT id, name, description FROM archrep.ar_technology_types ORDER BY name`,
  technology_types_select_search: `SELECT id, name, description FROM archrep.ar_technology_types WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY name`,
  technology_types_insert: `INSERT INTO archrep.ar_technology_types (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  technology_types_update: `UPDATE archrep.ar_technology_types SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  technology_types_delete: `DELETE FROM archrep.ar_technology_types WHERE id = $1`,

  // --- Principles ---
  principles_select: `SELECT id, name, statement, rationale, implications, is_approved, approve_document FROM archrep.ar_principles ORDER BY name`,
  principles_select_search: `SELECT id, name, statement, rationale, implications, is_approved, approve_document FROM archrep.ar_principles WHERE name ILIKE $1 OR COALESCE(statement,'') ILIKE $1 OR COALESCE(rationale,'') ILIKE $1 OR COALESCE(implications,'') ILIKE $1 OR COALESCE(approve_document,'') ILIKE $1 ORDER BY name`,
  principles_get: `SELECT * FROM archrep.ar_principles WHERE id = $1`,
  principles_insert: `INSERT INTO archrep.ar_principles (name, statement, rationale, implications, is_approved, approve_document) VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), COALESCE($5, false), NULLIF($6,'')) RETURNING *`,
  principles_update: `UPDATE archrep.ar_principles SET name=$1, statement=NULLIF($2,''), rationale=NULLIF($3,''), implications=NULLIF($4,''), is_approved=COALESCE($5, false), approve_document=NULLIF($6,'') WHERE id=$7 RETURNING *`,
  principles_delete: `DELETE FROM archrep.ar_principles WHERE id = $1`,
  principles_get_by_name: `SELECT * FROM archrep.ar_principles WHERE lower(trim(name)) = lower(trim($1)) LIMIT 1`,

  // --- Classificators, System assignments ---
  classificators_select: `SELECT id, name FROM archrep.ar_classificators ORDER BY name`,
  classificators_select_search: `SELECT id, name FROM archrep.ar_classificators WHERE name ILIKE $1 ORDER BY name`,
  classificators_insert: `INSERT INTO archrep.ar_classificators (name) VALUES ($1) RETURNING *`,
  classificators_update: `UPDATE archrep.ar_classificators SET name = $1 WHERE id = $2 RETURNING *`,
  classificators_delete: `DELETE FROM archrep.ar_classificators WHERE id = $1`,

  system_assignments_select: `SELECT id, name, description FROM archrep.ar_system_assignments ORDER BY name`,
  system_assignments_select_search: `SELECT id, name, description FROM archrep.ar_system_assignments WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY name`,
  system_assignments_insert: `INSERT INTO archrep.ar_system_assignments (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  system_assignments_update: `UPDATE archrep.ar_system_assignments SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  system_assignments_delete: `DELETE FROM archrep.ar_system_assignments WHERE id = $1`,

  // --- Systems-Technologies link ---
  /** Связи ИС–технология в метамодели (relation_type = $2, обычно system_technology). id — id строки ar_metamodel_relations. */
  /** $1 system id, $2 from_entity_type (system|subsystem), $3 relation_type code (issue #45). */
  systems_tech_metamodel_by_system: `
    SELECT r.id, r.from_entity_type, r.from_entity_id AS systems_id, r.to_entity_id AS technologies_id,
           r.relation_type, rrt.name AS relation_type_name, t.name AS technology_name
    FROM archrep.ar_metamodel_relations r
    JOIN archrep.ar_technologies t ON t.id = r.to_entity_id
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    WHERE r.from_entity_type = $2
      AND r.from_entity_id = $1::bigint
      AND r.to_entity_type = 'technology'
      AND r.relation_type = $3
    ORDER BY t.name`,
  /** Полный список: корневые ИС ($1) и модули ($2). */
  systems_tech_metamodel_select_all: `
    SELECT r.id, r.from_entity_type, r.from_entity_id AS systems_id, r.to_entity_id AS technologies_id,
           r.relation_type, rrt.name AS relation_type_name, s.name AS system_name, t.name AS technology_name
    FROM archrep.ar_metamodel_relations r
    JOIN archrep.ar_systems s ON s.id = r.from_entity_id
    JOIN archrep.ar_technologies t ON t.id = r.to_entity_id
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    WHERE r.to_entity_type = 'technology'
      AND (
        (r.from_entity_type = 'system' AND r.relation_type = $1)
        OR (r.from_entity_type = 'subsystem' AND r.relation_type = $2)
      )
    ORDER BY s.name, t.name`,
  metamodel_relations_find_system_tech: `
    SELECT id FROM archrep.ar_metamodel_relations
    WHERE from_entity_type = $2 AND from_entity_id = $1::bigint
      AND to_entity_type = 'technology' AND to_entity_id = $3::bigint
      AND relation_type = $4
    LIMIT 1`,

  // --- Architecture decisions v2: principle (ADRP) + applied (ADRA) + increments ---
  adr_statuses_select: `SELECT id, code, name, description FROM archrep.ar_adr_statuses ORDER BY name`,
  adr_status_get_name: `SELECT name, code FROM archrep.ar_adr_statuses WHERE id = $1`,

  adrs_principle_select: `SELECT p.id, p.code, p.name, p.context, p.decision, p.consequences, p.ar_adr_statuses_id, p.created_at, p.updated_at, p.author, s.name as status_name FROM archrep.ar_adrs_principle p LEFT JOIN archrep.ar_adr_statuses s ON p.ar_adr_statuses_id = s.id ORDER BY p.code`,
  adrs_principle_select_search: `SELECT p.id, p.code, p.name, p.context, p.decision, p.consequences, p.ar_adr_statuses_id, p.created_at, p.updated_at, p.author, s.name as status_name FROM archrep.ar_adrs_principle p LEFT JOIN archrep.ar_adr_statuses s ON p.ar_adr_statuses_id = s.id WHERE p.code ILIKE $1 OR p.name ILIKE $1 OR COALESCE(p.context,'') ILIKE $1 OR COALESCE(p.decision,'') ILIKE $1 OR COALESCE(p.consequences,'') ILIKE $1 ORDER BY p.code`,
  adrs_principle_get: `SELECT p.*, s.name as status_name FROM archrep.ar_adrs_principle p LEFT JOIN archrep.ar_adr_statuses s ON p.ar_adr_statuses_id = s.id WHERE p.id = $1`,
  adrs_principle_insert: `INSERT INTO archrep.ar_adrs_principle (code, name, context, decision, consequences, ar_adr_statuses_id, author) VALUES ($1 || nextval('archrep.adrp_code_seq')::text, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,'')::BIGINT, NULLIF($7,'')) RETURNING *`,
  adrs_principle_update: `UPDATE archrep.ar_adrs_principle SET name=$1, context=NULLIF($2,''), decision=NULLIF($3,''), consequences=NULLIF($4,''), ar_adr_statuses_id=NULLIF($5,'')::BIGINT, updated_at=current_timestamp, author=NULLIF($6,'') WHERE id=$7 RETURNING *`,
  adrs_principle_delete: `DELETE FROM archrep.ar_adrs_principle WHERE id = $1`,
  adrs_principle_get_by_code: `SELECT p.*, s.name as status_name FROM archrep.ar_adrs_principle p LEFT JOIN archrep.ar_adr_statuses s ON p.ar_adr_statuses_id = s.id WHERE p.code = $1`,

  adrs_applied_select: `SELECT a.id, a.code, a.task_name, a.task_link, a.conclusion, a.ar_adr_statuses_id, a.created_at, a.updated_at, a.author, s.name as status_name FROM archrep.ar_adrs_applied a LEFT JOIN archrep.ar_adr_statuses s ON a.ar_adr_statuses_id = s.id ORDER BY a.code`,
  adrs_applied_select_search: `SELECT a.id, a.code, a.task_name, a.task_link, a.conclusion, a.ar_adr_statuses_id, a.created_at, a.updated_at, a.author, s.name as status_name FROM archrep.ar_adrs_applied a LEFT JOIN archrep.ar_adr_statuses s ON a.ar_adr_statuses_id = s.id WHERE a.code ILIKE $1 OR COALESCE(a.task_name,'') ILIKE $1 OR COALESCE(a.task_link,'') ILIKE $1 OR COALESCE(a.conclusion,'') ILIKE $1 ORDER BY a.code`,
  adrs_applied_get: `SELECT a.*, s.name as status_name, s.code as status_code FROM archrep.ar_adrs_applied a LEFT JOIN archrep.ar_adr_statuses s ON a.ar_adr_statuses_id = s.id WHERE a.id = $1`,
  adrs_applied_insert: `INSERT INTO archrep.ar_adrs_applied (code, task_name, task_link, conclusion, ar_adr_statuses_id, author) VALUES ($1 || nextval('archrep.adra_code_seq')::text, NULLIF($2,''), NULLIF($3,''), NULLIF($4,''), NULLIF($5,'')::BIGINT, NULLIF($6,'')) RETURNING *`,
  adrs_applied_update: `UPDATE archrep.ar_adrs_applied SET task_name=NULLIF($1,''), task_link=NULLIF($2,''), conclusion=NULLIF($3,''), ar_adr_statuses_id=NULLIF($4,'')::BIGINT, updated_at=current_timestamp, author=NULLIF($5,'') WHERE id=$6 RETURNING *`,
  adrs_applied_delete: `DELETE FROM archrep.ar_adrs_applied WHERE id = $1`,

  adr_increment_types_select: `SELECT id, name, description FROM archrep.ar_adr_increment_types ORDER BY id`,

  adr_increments_by_applied: `SELECT inc.id, inc.ar_adrs_applied_id, inc.order_index, inc.name, inc.ar_adr_increment_types_id, t.name as type_name FROM archrep.ar_adr_increments inc LEFT JOIN archrep.ar_adr_increment_types t ON inc.ar_adr_increment_types_id = t.id WHERE inc.ar_adrs_applied_id = $1 ORDER BY inc.order_index, inc.id`,
  // BIGINT из JSON приходит числом: NULLIF($n,'')::BIGINT в PG даёт ошибку сравнения с '' — приводим через text
  adr_increments_insert: `INSERT INTO archrep.ar_adr_increments (ar_adrs_applied_id, order_index, name, ar_adr_increment_types_id) VALUES ($1, $2, NULLIF($3,''), (NULLIF(TRIM(COALESCE($4::text, '')), ''))::BIGINT) RETURNING *`,
  adr_increments_update: `UPDATE archrep.ar_adr_increments SET order_index=$1, name=NULLIF($2,''), ar_adr_increment_types_id=(NULLIF(TRIM(COALESCE($3::text, '')), ''))::BIGINT WHERE id=$4 RETURNING *`,
  adr_increments_delete: `DELETE FROM archrep.ar_adr_increments WHERE id = $1`,
  adr_increment_get: `SELECT id, ar_adrs_applied_id, order_index, name, ar_adr_increment_types_id FROM archrep.ar_adr_increments WHERE id = $1`,

  adr_increment_system_statuses_select: `SELECT id, code, name, description FROM archrep.ar_adr_increment_system_statuses ORDER BY name`,
  adr_increment_system_function_statuses_select: `SELECT id, code, name, description FROM archrep.ar_adr_increment_system_function_statuses ORDER BY name`,
  adr_increment_system_function_statuses_insert: `INSERT INTO archrep.ar_adr_increment_system_function_statuses (code, name, description) VALUES ($1, $2, NULLIF($3,'')) RETURNING *`,
  adr_increment_system_function_statuses_update: `UPDATE archrep.ar_adr_increment_system_function_statuses SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  adr_increment_system_function_statuses_delete: `DELETE FROM archrep.ar_adr_increment_system_function_statuses WHERE id = $1`,
  system_function_statuses_select: `SELECT id, code, name, description FROM archrep.ar_system_function_statuses ORDER BY name`,
  system_function_statuses_insert: `INSERT INTO archrep.ar_system_function_statuses (code, name, description) VALUES ($1, $2, NULLIF($3,'')) RETURNING *`,
  system_function_statuses_update: `UPDATE archrep.ar_system_function_statuses SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  system_function_statuses_delete: `DELETE FROM archrep.ar_system_function_statuses WHERE id = $1`,
  adr_increment_system_statuses_insert: `INSERT INTO archrep.ar_adr_increment_system_statuses (code, name, description) VALUES ($1, $2, NULLIF($3,'')) RETURNING *`,
  adr_increment_system_statuses_update: `UPDATE archrep.ar_adr_increment_system_statuses SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  adr_increment_system_statuses_delete: `DELETE FROM archrep.ar_adr_increment_system_statuses WHERE id = $1`,

  adr_increment_relation_statuses_select: `SELECT id, code, name, description FROM archrep.ar_adr_increment_relation_statuses ORDER BY name`,
  adr_increment_relation_statuses_insert: `INSERT INTO archrep.ar_adr_increment_relation_statuses (code, name, description) VALUES ($1, $2, NULLIF($3,'')) RETURNING *`,
  adr_increment_relation_statuses_update: `UPDATE archrep.ar_adr_increment_relation_statuses SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  adr_increment_relation_statuses_delete: `DELETE FROM archrep.ar_adr_increment_relation_statuses WHERE id = $1`,

  adr_increment_systems_by_increment: `SELECT ais.id, ais.ar_adr_increment_id, ais.ar_systems_id, ais.ar_adr_increment_system_statuses_id, ais.comment, s.code as system_code, s.name as system_name, st.name as status_name, st.code as status_code FROM archrep.ar_adr_increment_systems ais JOIN archrep.ar_systems s ON ais.ar_systems_id = s.id LEFT JOIN archrep.ar_adr_increment_system_statuses st ON ais.ar_adr_increment_system_statuses_id = st.id WHERE ais.ar_adr_increment_id = $1 ORDER BY s.name`,
  adr_increment_systems_by_applied: `SELECT ais.ar_systems_id, st.code AS increment_system_status_code FROM archrep.ar_adr_increment_systems ais JOIN archrep.ar_adr_increments inc ON ais.ar_adr_increment_id = inc.id LEFT JOIN archrep.ar_adr_increment_system_statuses st ON ais.ar_adr_increment_system_statuses_id = st.id WHERE inc.ar_adrs_applied_id = $1`,
  adr_increment_system_functions_by_applied: `SELECT sf.id AS ar_system_functions_id, sfc.code AS increment_sysfunc_status_code FROM archrep.ar_adr_increment_system_functions j JOIN archrep.ar_adr_increment_systems ais ON j.ar_adr_increment_system_id = ais.id JOIN archrep.ar_adr_increments inc ON ais.ar_adr_increment_id = inc.id JOIN archrep.ar_system_functions sf ON j.ar_system_functions_id = sf.id LEFT JOIN archrep.ar_adr_increment_system_function_statuses sfc ON sfc.id = j.ar_adr_increment_system_function_statuses_id WHERE inc.ar_adrs_applied_id = $1`,
  adr_increment_systems_insert: `INSERT INTO archrep.ar_adr_increment_systems (ar_adr_increment_id, ar_systems_id, ar_adr_increment_system_statuses_id, comment) VALUES ($1, $2, NULLIF($3,'')::BIGINT, NULLIF($4,'')) RETURNING *`,
  adr_increment_systems_delete: `DELETE FROM archrep.ar_adr_increment_systems WHERE id = $1`,
  adr_increment_systems_delete_by_increment: `DELETE FROM archrep.ar_adr_increment_systems WHERE ar_adr_increment_id = $1`,

  adr_increment_system_get_by_id: `SELECT id, ar_adr_increment_id, ar_systems_id, comment FROM archrep.ar_adr_increment_systems WHERE id = $1`,
  system_functions_by_system: `SELECT sf.id, sf.ar_systems_id, sf.name, sf.description, sf.ar_system_function_statuses_id, st.name as status_name, st.code as status_code FROM archrep.ar_system_functions sf LEFT JOIN archrep.ar_system_function_statuses st ON st.id = sf.ar_system_function_statuses_id WHERE sf.ar_systems_id = $1 ORDER BY lower(trim(sf.name)), sf.id`,
  system_functions_get_by_id: `SELECT sf.id, sf.ar_systems_id, sf.name, sf.description, sf.ar_system_function_statuses_id, st.name as status_name, st.code as status_code FROM archrep.ar_system_functions sf LEFT JOIN archrep.ar_system_function_statuses st ON st.id = sf.ar_system_function_statuses_id WHERE sf.id = $1`,
  /**
   * Полный список функций ИС без фильтра — для реестра агента `system_function`
   * (`list_entities` читает `select` без параметров; `system_functions_select_search` требует `$1`).
   */
  system_functions_select: `
    SELECT sf.id, sf.ar_systems_id, sf.name, sf.description, sf.ar_system_function_statuses_id, st.name as status_name, st.code as status_code
    FROM archrep.ar_system_functions sf
    LEFT JOIN archrep.ar_system_function_statuses st ON st.id = sf.ar_system_function_statuses_id
    ORDER BY lower(trim(sf.name)), sf.id
    LIMIT 300`,
  system_functions_select_search: `
    SELECT sf.id, sf.ar_systems_id, sf.name, sf.description, sf.ar_system_function_statuses_id, st.name as status_name
    FROM archrep.ar_system_functions sf
    LEFT JOIN archrep.ar_system_function_statuses st ON st.id = sf.ar_system_function_statuses_id
    WHERE ($1::text IS NULL OR trim($1::text) = '' OR sf.name ILIKE '%' || trim($1::text) || '%')
    ORDER BY lower(trim(sf.name)), sf.id
    LIMIT 300`,
  system_functions_insert: `INSERT INTO archrep.ar_system_functions (ar_systems_id, name, description) VALUES ($1, trim($2), NULLIF(trim($3),'')) RETURNING *`,
  system_functions_insert_with_status: `INSERT INTO archrep.ar_system_functions (ar_systems_id, name, description, ar_system_function_statuses_id) VALUES ($1, trim($2), NULLIF(trim($3),''), NULLIF($4,'')::BIGINT) RETURNING *`,
  system_function_status_update: `UPDATE archrep.ar_system_functions SET ar_system_function_statuses_id = NULLIF($1,'')::BIGINT, updated_at = current_timestamp WHERE id = $2 RETURNING *`,
  system_functions_delete_many: `DELETE FROM archrep.ar_system_functions WHERE ar_systems_id = $1 AND id = ANY($2::bigint[]) RETURNING id`,
  /** Какие заключения (ADR) и инкременты ссылаются на данные функции каталога — до DELETE. */
  system_functions_increment_usage_for_delete: `
    SELECT DISTINCT
      a.id AS ar_adrs_applied_id,
      a.code AS adr_code,
      a.task_name AS adr_task_name,
      inc.id AS ar_adr_increment_id,
      inc.name AS increment_name,
      sf.id AS ar_system_functions_id,
      sf.name AS function_name
    FROM archrep.ar_adr_increment_system_functions j
    INNER JOIN archrep.ar_system_functions sf ON j.ar_system_functions_id = sf.id
    INNER JOIN archrep.ar_adr_increment_systems ais ON j.ar_adr_increment_system_id = ais.id
    INNER JOIN archrep.ar_adr_increments inc ON ais.ar_adr_increment_id = inc.id
    INNER JOIN archrep.ar_adrs_applied a ON inc.ar_adrs_applied_id = a.id
    WHERE sf.ar_systems_id = $1 AND sf.id = ANY($2::bigint[])
    ORDER BY a.code, inc.name, sf.name
  `,
  adr_increment_system_functions_delete_by_row: `DELETE FROM archrep.ar_adr_increment_system_functions WHERE ar_adr_increment_system_id = $1`,
  adr_increment_system_functions_insert_row: `INSERT INTO archrep.ar_adr_increment_system_functions (ar_adr_increment_system_id, ar_system_functions_id, sort_order, ar_adr_increment_system_function_statuses_id) VALUES ($1, $2, $3, NULLIF($4,'')::BIGINT)`,
  adr_increment_systems_update_comment: `UPDATE archrep.ar_adr_increment_systems SET comment = NULLIF($1,'') WHERE id = $2 RETURNING *`,
  system_functions_by_ids_system: `SELECT id, name FROM archrep.ar_system_functions WHERE ar_systems_id = $1 AND id = ANY($2::bigint[])`,
  adr_increment_system_functions_ordered: `SELECT j.ar_system_functions_id, j.sort_order, j.ar_adr_increment_system_function_statuses_id, st.code AS increment_sysfunc_status_code FROM archrep.ar_adr_increment_system_functions j LEFT JOIN archrep.ar_adr_increment_system_function_statuses st ON st.id = j.ar_adr_increment_system_function_statuses_id WHERE j.ar_adr_increment_system_id = $1 ORDER BY j.sort_order, j.id`,
  // issue #74: у ar_systems нет колонки updated_at (только ar_system_functions/ar_integration_flows её имеют) —
  // не добавлять сюда updated_at, иначе 42703 «column "updated_at" of relation "ar_systems" does not exist».
  system_status_update: `UPDATE archrep.ar_systems SET ar_system_statuses_id = NULLIF($1,'')::BIGINT WHERE id = $2 RETURNING id`,

  adr_increment_relations_by_increment: `SELECT r.id, r.ar_adr_increment_id, r.from_ar_systems_id, r.to_ar_systems_id, r.name, r.description, r.ar_adr_increment_relation_statuses_id, r.ar_integration_flows_id, r.transferred_data, r.transfer_method, r.periodicity, r.ar_integration_flow_event_types_id, fs.code as from_code, fs.name as from_name, ts.code as to_code, ts.name as to_name, st.name as status_name, st.code as increment_relation_status_code, fstat.name as flow_status_name, fstat.code as flow_status_code, fet.name as flow_event_type_name FROM archrep.ar_adr_increment_relations r LEFT JOIN archrep.ar_systems fs ON r.from_ar_systems_id = fs.id LEFT JOIN archrep.ar_systems ts ON r.to_ar_systems_id = ts.id LEFT JOIN archrep.ar_adr_increment_relation_statuses st ON r.ar_adr_increment_relation_statuses_id = st.id LEFT JOIN archrep.ar_integration_flows f ON f.id = r.ar_integration_flows_id LEFT JOIN archrep.ar_integration_flow_statuses fstat ON fstat.id = f.ar_integration_flow_statuses_id LEFT JOIN archrep.ar_integration_flow_event_types fet ON fet.id = r.ar_integration_flow_event_types_id WHERE r.ar_adr_increment_id = $1 ORDER BY r.id`,
  /** $1 incId, $2 from, $3 to, $4 statusId, $5 flowId, $6 transferred_data, $7 transfer_method, $8 periodicity, $9 eventTypeId. name/description — legacy-зеркало реестровых полей. */
  adr_increment_relations_insert: `INSERT INTO archrep.ar_adr_increment_relations (ar_adr_increment_id, from_ar_systems_id, to_ar_systems_id, ar_adr_increment_relation_statuses_id, ar_integration_flows_id, transferred_data, transfer_method, periodicity, ar_integration_flow_event_types_id, name, description) VALUES ($1, NULLIF($2,'')::BIGINT, NULLIF($3,'')::BIGINT, NULLIF($4,'')::BIGINT, NULLIF($5,'')::BIGINT, NULLIF(btrim($6),''), NULLIF(btrim($7),''), NULLIF(btrim($8),''), NULLIF($9,'')::BIGINT, NULLIF(btrim($6),''), NULLIF(btrim($7),'')) RETURNING *`,
  adr_increment_relations_update: `UPDATE archrep.ar_adr_increment_relations SET from_ar_systems_id=NULLIF($1,'')::BIGINT, to_ar_systems_id=NULLIF($2,'')::BIGINT, ar_adr_increment_relation_statuses_id=NULLIF($3,'')::BIGINT, ar_integration_flows_id=NULLIF($4,'')::BIGINT, transferred_data=NULLIF(btrim($5),''), transfer_method=NULLIF(btrim($6),''), periodicity=NULLIF(btrim($7),''), ar_integration_flow_event_types_id=NULLIF($8,'')::BIGINT, name=NULLIF(btrim($5),''), description=NULLIF(btrim($6),'') WHERE id=$9 RETURNING *`,
  /** Проставить связь заключения найденному/созданному потоку (issue #74). */
  adr_increment_relations_set_flow: `UPDATE archrep.ar_adr_increment_relations SET ar_integration_flows_id = $1 WHERE id = $2 RETURNING id`,
  adr_increment_relations_delete: `DELETE FROM archrep.ar_adr_increment_relations WHERE id = $1`,
  adr_increment_relations_delete_by_increment: `DELETE FROM archrep.ar_adr_increment_relations WHERE ar_adr_increment_id = $1`,

  adr_increment_diagrams_list_meta: `SELECT d.id, d.ar_adr_increment_id, d.version_no, d.created_at, d.updated_at, d.last_edited_by FROM archrep.ar_adr_increment_diagrams d WHERE d.ar_adr_increment_id = $1 ORDER BY d.version_no DESC`,
  adr_increment_diagrams_get: `SELECT d.id, d.ar_adr_increment_id, d.version_no, d.mxfile, d.created_at, d.updated_at, d.last_edited_by FROM archrep.ar_adr_increment_diagrams d WHERE d.id = $1 AND d.ar_adr_increment_id = $2`,
  adr_increment_diagrams_max_version: `SELECT COALESCE(MAX(version_no), 0)::int AS max_v FROM archrep.ar_adr_increment_diagrams WHERE ar_adr_increment_id = $1`,
  adr_increment_diagrams_insert: `INSERT INTO archrep.ar_adr_increment_diagrams (ar_adr_increment_id, version_no, mxfile, last_edited_by) VALUES ($1, $2, $3, NULLIF($4,'')) RETURNING *`,
  adr_increment_diagrams_update_mxfile: `UPDATE archrep.ar_adr_increment_diagrams SET mxfile = $1, updated_at = current_timestamp, last_edited_by = NULLIF($2,'') WHERE id = $3 AND ar_adr_increment_id = $4 RETURNING *`,
  adr_increment_diagrams_delete: `DELETE FROM archrep.ar_adr_increment_diagrams WHERE id = $1 AND ar_adr_increment_id = $2`,
  /** Схемы всех решений заключения (для восстановления после пересоздания инкрементов, issue #74). */
  adr_increment_diagrams_by_applied: `SELECT d.id, d.version_no, d.mxfile, d.last_edited_by, d.created_at, d.updated_at, inc.order_index, inc.name AS increment_name FROM archrep.ar_adr_increment_diagrams d JOIN archrep.ar_adr_increments inc ON inc.id = d.ar_adr_increment_id WHERE inc.ar_adrs_applied_id = $1 ORDER BY d.id`,
  /** Вставка схемы с сохранением версии и таймстемпов (восстановление после пересоздания инкрементов). */
  adr_increment_diagrams_insert_full: `INSERT INTO archrep.ar_adr_increment_diagrams (ar_adr_increment_id, version_no, mxfile, last_edited_by, created_at, updated_at) VALUES ($1, $2, $3, NULLIF($4,''), COALESCE($5, current_timestamp), COALESCE($6, current_timestamp)) RETURNING id`,

  integration_flows_select: `SELECT f.id, f.source_ar_systems_id, f.target_ar_systems_id, f.ar_integration_flow_event_types_id, f.transferred_data, f.transfer_method, f.periodicity, f.ar_integration_flow_statuses_id, f.created_at, f.updated_at, src.name as source_name, src.code as source_code, COALESCE(src.name,'') || CASE WHEN COALESCE(src.code,'') <> '' THEN ' (' || src.code || ')' ELSE '' END as source_display_name, tgt.name as target_name, tgt.code as target_code, COALESCE(tgt.name,'') || CASE WHEN COALESCE(tgt.code,'') <> '' THEN ' (' || tgt.code || ')' ELSE '' END as target_display_name, et.name as event_type_name, st.name as status_name FROM archrep.ar_integration_flows f LEFT JOIN archrep.ar_systems src ON f.source_ar_systems_id = src.id LEFT JOIN archrep.ar_systems tgt ON f.target_ar_systems_id = tgt.id LEFT JOIN archrep.ar_integration_flow_event_types et ON f.ar_integration_flow_event_types_id = et.id LEFT JOIN archrep.ar_integration_flow_statuses st ON f.ar_integration_flow_statuses_id = st.id ORDER BY src.name, tgt.name`,
  integration_flows_select_search: `SELECT f.id, f.source_ar_systems_id, f.target_ar_systems_id, f.ar_integration_flow_event_types_id, f.transferred_data, f.transfer_method, f.periodicity, f.ar_integration_flow_statuses_id, f.created_at, f.updated_at, src.name as source_name, src.code as source_code, COALESCE(src.name,'') || CASE WHEN COALESCE(src.code,'') <> '' THEN ' (' || src.code || ')' ELSE '' END as source_display_name, tgt.name as target_name, tgt.code as target_code, COALESCE(tgt.name,'') || CASE WHEN COALESCE(tgt.code,'') <> '' THEN ' (' || tgt.code || ')' ELSE '' END as target_display_name, et.name as event_type_name, st.name as status_name FROM archrep.ar_integration_flows f LEFT JOIN archrep.ar_systems src ON f.source_ar_systems_id = src.id LEFT JOIN archrep.ar_systems tgt ON f.target_ar_systems_id = tgt.id LEFT JOIN archrep.ar_integration_flow_event_types et ON f.ar_integration_flow_event_types_id = et.id LEFT JOIN archrep.ar_integration_flow_statuses st ON f.ar_integration_flow_statuses_id = st.id WHERE (src.name ILIKE $1 OR src.code ILIKE $1 OR tgt.name ILIKE $1 OR tgt.code ILIKE $1 OR COALESCE(et.name,'') ILIKE $1 OR COALESCE(st.name,'') ILIKE $1 OR COALESCE(f.transferred_data,'') ILIKE $1 OR COALESCE(f.transfer_method,'') ILIKE $1 OR COALESCE(f.periodicity,'') ILIKE $1) ORDER BY src.name, tgt.name`,
  integration_flows_by_system: `SELECT f.id, f.source_ar_systems_id, f.target_ar_systems_id, f.ar_integration_flow_event_types_id, f.transferred_data, f.transfer_method, f.periodicity, f.ar_integration_flow_statuses_id, f.created_at, f.updated_at, src.name as source_name, src.code as source_code, COALESCE(src.name,'') || CASE WHEN COALESCE(src.code,'') <> '' THEN ' (' || src.code || ')' ELSE '' END as source_display_name, tgt.name as target_name, tgt.code as target_code, COALESCE(tgt.name,'') || CASE WHEN COALESCE(tgt.code,'') <> '' THEN ' (' || tgt.code || ')' ELSE '' END as target_display_name, et.name as event_type_name, st.name as status_name FROM archrep.ar_integration_flows f LEFT JOIN archrep.ar_systems src ON f.source_ar_systems_id = src.id LEFT JOIN archrep.ar_systems tgt ON f.target_ar_systems_id = tgt.id LEFT JOIN archrep.ar_integration_flow_event_types et ON f.ar_integration_flow_event_types_id = et.id LEFT JOIN archrep.ar_integration_flow_statuses st ON f.ar_integration_flow_statuses_id = st.id WHERE f.source_ar_systems_id = $1 OR f.target_ar_systems_id = $1 ORDER BY src.name, tgt.name`,
  /** Потоки реестра по паре «источник → получатель» с учётом направления (issue #74). */
  integration_flows_by_pair: `SELECT f.id, f.source_ar_systems_id, f.target_ar_systems_id, f.ar_integration_flow_event_types_id, f.transferred_data, f.transfer_method, f.periodicity, f.ar_integration_flow_statuses_id, f.created_at, f.updated_at, et.name as event_type_name, st.name as status_name, st.code as status_code FROM archrep.ar_integration_flows f LEFT JOIN archrep.ar_integration_flow_event_types et ON f.ar_integration_flow_event_types_id = et.id LEFT JOIN archrep.ar_integration_flow_statuses st ON f.ar_integration_flow_statuses_id = st.id WHERE f.source_ar_systems_id = $1 AND f.target_ar_systems_id = $2 ORDER BY lower(coalesce(f.transferred_data, '')), f.id`,
  /** Обновление существующего потока из заключения: статус (+ реестровые поля при «Модифицируется») и привязка к связи. */
  integration_flows_update_from_conclusion: `UPDATE archrep.ar_integration_flows SET ar_integration_flow_statuses_id = NULLIF($1,'')::BIGINT, ar_integration_flow_event_types_id = NULLIF($2,'')::BIGINT, transferred_data = NULLIF(btrim($3),''), transfer_method = NULLIF(btrim($4),''), periodicity = NULLIF(btrim($5),''), ar_adr_increment_relation_id = $6, updated_at = current_timestamp WHERE id = $7 RETURNING id`,
  /** Обновление только статуса и привязки существующего потока (статус «Используется»). */
  integration_flows_update_status_and_link: `UPDATE archrep.ar_integration_flows SET ar_integration_flow_statuses_id = NULLIF($1,'')::BIGINT, ar_adr_increment_relation_id = $2, updated_at = current_timestamp WHERE id = $3 RETURNING id`,
  integration_flows_get: `SELECT f.*, src.name as source_name, src.code as source_code, COALESCE(src.name,'') || CASE WHEN COALESCE(src.code,'') <> '' THEN ' (' || src.code || ')' ELSE '' END as source_display_name, tgt.name as target_name, tgt.code as target_code, COALESCE(tgt.name,'') || CASE WHEN COALESCE(tgt.code,'') <> '' THEN ' (' || tgt.code || ')' ELSE '' END as target_display_name, et.name as event_type_name, st.name as status_name FROM archrep.ar_integration_flows f LEFT JOIN archrep.ar_systems src ON f.source_ar_systems_id = src.id LEFT JOIN archrep.ar_systems tgt ON f.target_ar_systems_id = tgt.id LEFT JOIN archrep.ar_integration_flow_event_types et ON f.ar_integration_flow_event_types_id = et.id LEFT JOIN archrep.ar_integration_flow_statuses st ON f.ar_integration_flow_statuses_id = st.id WHERE f.id = $1`,
  integration_flows_insert: `INSERT INTO archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id, ar_integration_flow_event_types_id, transferred_data, transfer_method, periodicity, ar_integration_flow_statuses_id) VALUES ($1, $2, NULLIF($3,'')::BIGINT, NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,'')::BIGINT) RETURNING *`,
  integration_flows_insert_from_conclusion: `INSERT INTO archrep.ar_integration_flows (source_ar_systems_id, target_ar_systems_id, ar_integration_flow_event_types_id, transferred_data, transfer_method, periodicity, ar_integration_flow_statuses_id, ar_adrs_applied_id, ar_adr_increment_relation_id) VALUES ($1, $2, NULL, NULLIF($3,''), NULLIF($4,''), NULL, NULLIF($5,'')::BIGINT, $6, $7) RETURNING *`,
  /**
   * Идемпотентный поиск потока, созданного из этого заключения, по концам и наименованию (issue #74, п.3):
   * связи инкремента при сохранении пересоздаются, поэтому опираться на ar_adr_increment_relation_id нельзя.
   */
  integration_flows_find_by_applied_endpoints: `SELECT id FROM archrep.ar_integration_flows WHERE ar_adrs_applied_id = $1 AND source_ar_systems_id = $2 AND target_ar_systems_id = $3 AND COALESCE(NULLIF(btrim(transferred_data), ''), '') = COALESCE(NULLIF(btrim($4), ''), '') ORDER BY id LIMIT 1`,
  /** Обновление существующего потока заключения (статус + привязка к актуальной связи). */
  integration_flows_update_status_from_conclusion: `UPDATE archrep.ar_integration_flows SET ar_integration_flow_statuses_id = NULLIF($1,'')::BIGINT, ar_adr_increment_relation_id = $2, updated_at = current_timestamp WHERE id = $3 RETURNING id`,
  integration_flow_exists_by_relation_id: `SELECT 1 FROM archrep.ar_integration_flows WHERE ar_adr_increment_relation_id = $1 LIMIT 1`,
  integration_flows_update: `UPDATE archrep.ar_integration_flows SET source_ar_systems_id=$1, target_ar_systems_id=$2, ar_integration_flow_event_types_id=NULLIF($3,'')::BIGINT, transferred_data=NULLIF($4,''), transfer_method=NULLIF($5,''), periodicity=NULLIF($6,''), ar_integration_flow_statuses_id=NULLIF($7,'')::BIGINT, updated_at=current_timestamp WHERE id=$8 RETURNING *`,
  integration_flows_delete: `DELETE FROM archrep.ar_integration_flows WHERE id = $1`,
  integration_flow_event_types_select: `SELECT id, name, description FROM archrep.ar_integration_flow_event_types ORDER BY id`,
  integration_flow_event_types_select_search: `SELECT id, name, description FROM archrep.ar_integration_flow_event_types WHERE name ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY id`,
  integration_flow_event_types_insert: `INSERT INTO archrep.ar_integration_flow_event_types (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  integration_flow_event_types_update: `UPDATE archrep.ar_integration_flow_event_types SET name=$1, description=NULLIF($2,'') WHERE id=$3 RETURNING *`,
  integration_flow_event_types_delete: `DELETE FROM archrep.ar_integration_flow_event_types WHERE id = $1`,
  integration_flow_statuses_select: `SELECT id, code, name, description FROM archrep.ar_integration_flow_statuses ORDER BY id`,
  integration_flow_statuses_select_search: `SELECT id, code, name, description FROM archrep.ar_integration_flow_statuses WHERE name ILIKE $1 OR code ILIKE $1 OR COALESCE(description,'') ILIKE $1 ORDER BY id`,
  integration_flow_statuses_insert: `INSERT INTO archrep.ar_integration_flow_statuses (code, name, description) VALUES ($1, $2, NULLIF($3,'')) RETURNING *`,
  integration_flow_statuses_update: `UPDATE archrep.ar_integration_flow_statuses SET code=$1, name=$2, description=NULLIF($3,'') WHERE id=$4 RETURNING *`,
  integration_flow_statuses_delete: `DELETE FROM archrep.ar_integration_flow_statuses WHERE id = $1`,

  // --- TOGAF Metamodel (task #14) ---
  metamodel_entity_types_select: `SELECT id, code, name, table_name, disp_param_name, description, COALESCE(import_allowed, false) AS import_allowed FROM archrep.ar_metamodel_entity_types ORDER BY code`,
  metamodel_entity_types_get: `SELECT id, code, name, table_name, disp_param_name, description, COALESCE(import_allowed, false) AS import_allowed FROM archrep.ar_metamodel_entity_types WHERE id = $1`,
  metamodel_entity_types_insert: `INSERT INTO archrep.ar_metamodel_entity_types (code, name, table_name, disp_param_name, description, import_allowed) VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), COALESCE($6, false)) RETURNING *`,
  metamodel_entity_types_update: `UPDATE archrep.ar_metamodel_entity_types SET code = $1, name = $2, table_name = NULLIF($3,''), disp_param_name = NULLIF($4,''), description = NULLIF($5,''), import_allowed = COALESCE($6, false) WHERE id = $7 RETURNING *`,
  metamodel_entity_types_delete: `DELETE FROM archrep.ar_metamodel_entity_types WHERE id = $1`,
  metamodel_entity_types_importable: `SELECT id, code, name, table_name, disp_param_name, description, import_allowed FROM archrep.ar_metamodel_entity_types WHERE import_allowed = true ORDER BY name`,
  /** Проверка disp_param_name каталога типов: параметр существует и строковый (DISP_*). */
  settings_parameters_check_string: `SELECT 1 FROM archrep.ar_settings_parameters WHERE code = $1 AND lower(COALESCE(value_type, 'string')) = 'string'`,

  metamodel_relation_types_select: `
    SELECT r.id, r.code, r.name, r.description, r.from_entity_type_id, r.to_entity_type_id, r.managed,
           f.code AS from_entity_type_code, f.name AS from_entity_type_name,
           t.code AS to_entity_type_code, t.name AS to_entity_type_name
    FROM archrep.ar_metamodel_relation_types r
    JOIN archrep.ar_metamodel_entity_types f ON r.from_entity_type_id = f.id
    JOIN archrep.ar_metamodel_entity_types t ON r.to_entity_type_id = t.id
    ORDER BY r.code, f.code, t.code`,
  metamodel_relation_types_get: `
    SELECT r.id, r.code, r.name, r.description, r.from_entity_type_id, r.to_entity_type_id, r.managed,
           f.code AS from_entity_type_code, f.name AS from_entity_type_name,
           t.code AS to_entity_type_code, t.name AS to_entity_type_name
    FROM archrep.ar_metamodel_relation_types r
    JOIN archrep.ar_metamodel_entity_types f ON r.from_entity_type_id = f.id
    JOIN archrep.ar_metamodel_entity_types t ON r.to_entity_type_id = t.id
    WHERE r.id = $1`,
  metamodel_relation_types_insert: `INSERT INTO archrep.ar_metamodel_relation_types (code, name, description, from_entity_type_id, to_entity_type_id, managed) VALUES ($1, $2, NULLIF($3,''), $4, $5, COALESCE($6, false)) RETURNING *`,
  metamodel_relation_types_update: `UPDATE archrep.ar_metamodel_relation_types SET code = $1, name = $2, description = NULLIF($3,''), from_entity_type_id = $4, to_entity_type_id = $5, managed = COALESCE($6, false) WHERE id = $7 RETURNING *`,
  metamodel_relation_types_delete: `DELETE FROM archrep.ar_metamodel_relation_types WHERE id = $1`,
  // relation_type_name — ar_metamodel_relation_types.name для пары (relation_type, from, to); для графа и списков при пустом name/displayed_name
  metamodel_relations_select: `
    SELECT r.id, r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id, r.relation_type, r.name, r.displayed_name, r.reference_to_baserow, r.description, r.payload, r.created_at, r.updated_at,
           rrt.name AS relation_type_name, COALESCE(rrt.managed, false) AS relation_type_managed
    FROM archrep.ar_metamodel_relations r
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    ORDER BY r.id DESC`,
  metamodel_relations_select_search: `
    SELECT r.id, r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id, r.relation_type, r.name, r.displayed_name, r.reference_to_baserow, r.description, r.payload, r.created_at, r.updated_at,
           rrt.name AS relation_type_name, COALESCE(rrt.managed, false) AS relation_type_managed
    FROM archrep.ar_metamodel_relations r
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    WHERE (r.from_entity_type ILIKE $1 OR r.to_entity_type ILIKE $1 OR r.relation_type ILIKE $1 OR COALESCE(r.name,'') ILIKE $1 OR COALESCE(r.displayed_name,'') ILIKE $1 OR COALESCE(r.description,'') ILIKE $1 OR COALESCE(rrt.name,'') ILIKE $1
           OR archrep.metamodel_entity_search_text(r.from_entity_type, r.from_entity_id) ILIKE $1
           OR archrep.metamodel_entity_search_text(r.to_entity_type, r.to_entity_id) ILIKE $1)
    ORDER BY r.id DESC`,
  metamodel_relations_get: `
    SELECT r.*, rrt.name AS relation_type_name, COALESCE(rrt.managed, false) AS relation_type_managed
    FROM archrep.ar_metamodel_relations r
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    WHERE r.id = $1`,
  metamodel_relations_insert: `INSERT INTO archrep.ar_metamodel_relations (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relation_type, name, description, payload, displayed_name, reference_to_baserow) VALUES ($1, $2, $3, $4, $5, NULLIF($6,''), NULLIF($7,''), $8::jsonb, NULLIF($9,''), $10) RETURNING *`,
  metamodel_relations_update: `UPDATE archrep.ar_metamodel_relations SET from_entity_type=$1, from_entity_id=$2, to_entity_type=$3, to_entity_id=$4, relation_type=$5, name=NULLIF($6,''), description=NULLIF($7,''), payload=$8::jsonb, displayed_name=NULLIF($9,''), reference_to_baserow=$10, updated_at=current_timestamp WHERE id=$11 RETURNING *`,
  metamodel_relations_delete: `DELETE FROM archrep.ar_metamodel_relations WHERE id = $1`,

  togaf_organization_unit_categories_select: `SELECT id, code, name, description FROM archrep.ar_organization_unit_categories ORDER BY name`,
  togaf_organization_unit_categories_get: `SELECT id, code, name, description FROM archrep.ar_organization_unit_categories WHERE id = $1`,
  togaf_organization_unit_categories_insert: `INSERT INTO archrep.ar_organization_unit_categories (code, name, description) VALUES (NULLIF($1,''), $2, NULLIF($3,'')) RETURNING *`,
  togaf_organization_unit_categories_update: `UPDATE archrep.ar_organization_unit_categories SET code=NULLIF($1,''), name=$2, description=NULLIF($3,'') WHERE id=$4 RETURNING *`,
  togaf_organization_unit_categories_delete: `DELETE FROM archrep.ar_organization_unit_categories WHERE id = $1`,

  togaf_actor_types_select: `SELECT id, code, name, description FROM archrep.ar_actor_types ORDER BY name`,
  togaf_actor_types_get: `SELECT id, code, name, description FROM archrep.ar_actor_types WHERE id = $1`,
  togaf_actor_types_insert: `INSERT INTO archrep.ar_actor_types (code, name, description) VALUES (NULLIF($1,''), $2, NULLIF($3,'')) RETURNING *`,
  togaf_actor_types_update: `UPDATE archrep.ar_actor_types SET code=NULLIF($1,''), name=$2, description=NULLIF($3,'') WHERE id=$4 RETURNING *`,
  togaf_actor_types_delete: `DELETE FROM archrep.ar_actor_types WHERE id = $1`,

  togaf_business_service_statuses_select: `SELECT id, name, description FROM archrep.ar_business_service_statuses ORDER BY name`,
  togaf_business_service_statuses_get: `SELECT id, name, description FROM archrep.ar_business_service_statuses WHERE id = $1`,
  togaf_business_service_statuses_insert: `INSERT INTO archrep.ar_business_service_statuses (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  togaf_business_service_statuses_update: `UPDATE archrep.ar_business_service_statuses SET name=$1, description=NULLIF($2,'') WHERE id=$3 RETURNING *`,
  togaf_business_service_statuses_delete: `DELETE FROM archrep.ar_business_service_statuses WHERE id = $1`,

  togaf_organization_units_select: `SELECT o.id, o.name, o.fullname, o.parent_id, o.description, o.leader, o.organization_unit_categories_id, o.created_at, o.updated_at, c.name as category_name, c.code as category_code, p.name as parent_name FROM archrep.ar_organization_units o LEFT JOIN archrep.ar_organization_unit_categories c ON o.organization_unit_categories_id = c.id LEFT JOIN archrep.ar_organization_units p ON o.parent_id = p.id ORDER BY o.name`,
  togaf_organization_units_select_search: `SELECT o.id, o.name, o.fullname, o.parent_id, o.description, o.leader, o.organization_unit_categories_id, o.created_at, o.updated_at, c.name as category_name, c.code as category_code, p.name as parent_name FROM archrep.ar_organization_units o LEFT JOIN archrep.ar_organization_unit_categories c ON o.organization_unit_categories_id = c.id LEFT JOIN archrep.ar_organization_units p ON o.parent_id = p.id WHERE (o.name ILIKE $1 OR COALESCE(o.fullname,'') ILIKE $1 OR COALESCE(o.description,'') ILIKE $1 OR COALESCE(o.leader,'') ILIKE $1 OR COALESCE(c.name,'') ILIKE $1) ORDER BY o.name`,
  togaf_organization_units_get: `SELECT o.id, o.name, o.fullname, o.parent_id, o.description, o.leader, o.organization_unit_categories_id, o.created_at, o.updated_at, c.name as category_name, p.name as parent_name FROM archrep.ar_organization_units o LEFT JOIN archrep.ar_organization_unit_categories c ON o.organization_unit_categories_id = c.id LEFT JOIN archrep.ar_organization_units p ON o.parent_id = p.id WHERE o.id = $1`,
  togaf_organization_units_get_by_name: `SELECT o.id, o.name, o.fullname, o.parent_id, o.description, o.leader, o.organization_unit_categories_id, o.created_at, o.updated_at, c.name as category_name, p.name as parent_name FROM archrep.ar_organization_units o LEFT JOIN archrep.ar_organization_unit_categories c ON o.organization_unit_categories_id = c.id LEFT JOIN archrep.ar_organization_units p ON o.parent_id = p.id WHERE lower(trim(o.name)) = lower(trim($1)) LIMIT 1`,
  togaf_organization_units_insert: `INSERT INTO archrep.ar_organization_units (name, fullname, parent_id, description, leader, organization_unit_categories_id) VALUES ($1, NULLIF($2,''), NULLIF($3,'')::BIGINT, NULLIF($4,''), NULLIF($5,''), NULLIF($6,'')::BIGINT) RETURNING id, name, fullname, parent_id, description, leader, organization_unit_categories_id, created_at, updated_at`,
  togaf_organization_units_update: `UPDATE archrep.ar_organization_units SET name=$1, fullname=NULLIF($2,''), parent_id=NULLIF($3,'')::BIGINT, description=NULLIF($4,''), leader=NULLIF($5,''), organization_unit_categories_id=NULLIF($6,'')::BIGINT, updated_at=current_timestamp WHERE id=$7 RETURNING id, name, fullname, parent_id, description, leader, organization_unit_categories_id, created_at, updated_at`,
  togaf_organization_units_delete: `DELETE FROM archrep.ar_organization_units WHERE id = $1`,

  togaf_actors_select: `SELECT a.id, a.name, a.description, a.organization_unit_id, a.actor_type_id, a.created_at, a.updated_at, o.name as organization_unit_name, t.name as actor_type_name FROM archrep.ar_actors a LEFT JOIN archrep.ar_organization_units o ON a.organization_unit_id = o.id LEFT JOIN archrep.ar_actor_types t ON a.actor_type_id = t.id ORDER BY a.name`,
  togaf_actors_select_search: `SELECT a.id, a.name, a.description, a.organization_unit_id, a.actor_type_id, a.created_at, a.updated_at, o.name as organization_unit_name, t.name as actor_type_name FROM archrep.ar_actors a LEFT JOIN archrep.ar_organization_units o ON a.organization_unit_id = o.id LEFT JOIN archrep.ar_actor_types t ON a.actor_type_id = t.id WHERE (a.name ILIKE $1 OR COALESCE(a.description,'') ILIKE $1 OR COALESCE(o.name,'') ILIKE $1 OR COALESCE(t.name,'') ILIKE $1) ORDER BY a.name`,
  togaf_actors_get: `SELECT a.id, a.name, a.description, a.organization_unit_id, a.actor_type_id, a.created_at, a.updated_at, o.name as organization_unit_name, t.name as actor_type_name FROM archrep.ar_actors a LEFT JOIN archrep.ar_organization_units o ON a.organization_unit_id = o.id LEFT JOIN archrep.ar_actor_types t ON a.actor_type_id = t.id WHERE a.id = $1`,
  togaf_actors_get_by_name: `SELECT a.id, a.name, a.description, a.organization_unit_id, a.actor_type_id, a.created_at, a.updated_at, o.name as organization_unit_name, t.name as actor_type_name FROM archrep.ar_actors a LEFT JOIN archrep.ar_organization_units o ON a.organization_unit_id = o.id LEFT JOIN archrep.ar_actor_types t ON a.actor_type_id = t.id WHERE lower(trim(a.name)) = lower(trim($1)) LIMIT 1`,
  togaf_actors_insert: `INSERT INTO archrep.ar_actors (name, description, organization_unit_id, actor_type_id) VALUES ($1, NULLIF($2,''), NULLIF($3,'')::BIGINT, NULLIF($4,'')::BIGINT) RETURNING id, name, description, organization_unit_id, actor_type_id, created_at, updated_at`,
  togaf_actors_update: `UPDATE archrep.ar_actors SET name=$1, description=NULLIF($2,''), organization_unit_id=NULLIF($3,'')::BIGINT, actor_type_id=NULLIF($4,'')::BIGINT, updated_at=current_timestamp WHERE id=$5 RETURNING id, name, description, organization_unit_id, actor_type_id, created_at, updated_at`,
  togaf_actors_delete: `DELETE FROM archrep.ar_actors WHERE id = $1`,

  togaf_business_services_select: `SELECT b.id, b.name, b.fullname, b.description, b.ar_organization_units_id, b.ar_business_service_statuses_id, b.created_at, b.updated_at, o.name as owner_name, s.name as status_name FROM archrep.ar_business_services b LEFT JOIN archrep.ar_organization_units o ON b.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_service_statuses s ON b.ar_business_service_statuses_id = s.id ORDER BY b.name`,
  togaf_business_services_select_search: `SELECT b.id, b.name, b.fullname, b.description, b.ar_organization_units_id, b.ar_business_service_statuses_id, b.created_at, b.updated_at, o.name as owner_name, s.name as status_name FROM archrep.ar_business_services b LEFT JOIN archrep.ar_organization_units o ON b.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_service_statuses s ON b.ar_business_service_statuses_id = s.id WHERE (b.name ILIKE $1 OR COALESCE(b.fullname,'') ILIKE $1 OR COALESCE(b.description,'') ILIKE $1 OR COALESCE(o.name,'') ILIKE $1 OR COALESCE(s.name,'') ILIKE $1) ORDER BY b.name`,
  togaf_business_services_get: `SELECT b.id, b.name, b.fullname, b.description, b.ar_organization_units_id, b.ar_business_service_statuses_id, b.created_at, b.updated_at, o.name as owner_name, s.name as status_name FROM archrep.ar_business_services b LEFT JOIN archrep.ar_organization_units o ON b.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_service_statuses s ON b.ar_business_service_statuses_id = s.id WHERE b.id = $1`,
  togaf_business_services_get_by_name: `SELECT b.id, b.name, b.fullname, b.description, b.ar_organization_units_id, b.ar_business_service_statuses_id, b.created_at, b.updated_at, o.name as owner_name, s.name as status_name FROM archrep.ar_business_services b LEFT JOIN archrep.ar_organization_units o ON b.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_service_statuses s ON b.ar_business_service_statuses_id = s.id WHERE lower(trim(b.name)) = lower(trim($1)) LIMIT 1`,
  togaf_business_services_insert: `INSERT INTO archrep.ar_business_services (name, fullname, description, ar_organization_units_id, ar_business_service_statuses_id) VALUES ($1, NULLIF($2,''), NULLIF($3,''), NULLIF($4,'')::BIGINT, NULLIF($5,'')::BIGINT) RETURNING id, name, fullname, description, ar_organization_units_id, ar_business_service_statuses_id, created_at, updated_at`,
  togaf_business_services_update: `UPDATE archrep.ar_business_services SET name=$1, fullname=NULLIF($2,''), description=NULLIF($3,''), ar_organization_units_id=NULLIF($4,'')::BIGINT, ar_business_service_statuses_id=NULLIF($5,'')::BIGINT, updated_at=current_timestamp WHERE id=$6 RETURNING id, name, fullname, description, ar_organization_units_id, ar_business_service_statuses_id, created_at, updated_at`,
  togaf_business_services_delete: `DELETE FROM archrep.ar_business_services WHERE id = $1`,

  togaf_business_functions_select: `SELECT f.id, f.name, f.description, f.parent_id, f.ar_organization_units_id, f.created_at, f.updated_at, o.name as owner_name, p.name as parent_name FROM archrep.ar_business_functions f LEFT JOIN archrep.ar_organization_units o ON f.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_functions p ON f.parent_id = p.id ORDER BY f.name`,
  togaf_business_functions_select_search: `SELECT f.id, f.name, f.description, f.parent_id, f.ar_organization_units_id, f.created_at, f.updated_at, o.name as owner_name, p.name as parent_name FROM archrep.ar_business_functions f LEFT JOIN archrep.ar_organization_units o ON f.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_functions p ON f.parent_id = p.id WHERE (f.name ILIKE $1 OR COALESCE(f.description,'') ILIKE $1 OR COALESCE(o.name,'') ILIKE $1) ORDER BY f.name`,
  togaf_business_functions_get: `SELECT f.id, f.name, f.description, f.parent_id, f.ar_organization_units_id, f.created_at, f.updated_at, o.name as owner_name, p.name as parent_name FROM archrep.ar_business_functions f LEFT JOIN archrep.ar_organization_units o ON f.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_functions p ON f.parent_id = p.id WHERE f.id = $1`,
  togaf_business_functions_get_by_name: `SELECT f.id, f.name, f.description, f.parent_id, f.ar_organization_units_id, f.created_at, f.updated_at, o.name as owner_name, p.name as parent_name FROM archrep.ar_business_functions f LEFT JOIN archrep.ar_organization_units o ON f.ar_organization_units_id = o.id LEFT JOIN archrep.ar_business_functions p ON f.parent_id = p.id WHERE lower(trim(f.name)) = lower(trim($1)) LIMIT 1`,
  togaf_business_functions_insert: `INSERT INTO archrep.ar_business_functions (name, description, parent_id, ar_organization_units_id) VALUES ($1, NULLIF($2,''), NULLIF($3,'')::BIGINT, NULLIF($4,'')::BIGINT) RETURNING id, name, description, parent_id, ar_organization_units_id, created_at, updated_at`,
  togaf_business_functions_update: `UPDATE archrep.ar_business_functions SET name=$1, description=NULLIF($2,''), parent_id=NULLIF($3,'')::BIGINT, ar_organization_units_id=NULLIF($4,'')::BIGINT, updated_at=current_timestamp WHERE id=$5 RETURNING id, name, description, parent_id, ar_organization_units_id, created_at, updated_at`,
  togaf_business_functions_delete: `DELETE FROM archrep.ar_business_functions WHERE id = $1`,

  // --- Architecture debt registry (issue #23) ---
  gaps_select: `
    SELECT g.id, g.code, g.name, g.description, g.consequences, g.ar_impact_level_types_id, g.remediation_effort,
           g.target_date, g.ar_gap_states_id, g.resolved_date, g.ar_adr_statuses_id, g.ar_gap_types_id, g.source, g.responsible_person,
           g.created_at, g.updated_at,
           il.name as impact_level_name, gs.name as gap_state_name, st.name as adr_status_name, gt.name as gap_type_name
    FROM archrep.ar_gaps g
    LEFT JOIN archrep.ar_impact_level_types il ON g.ar_impact_level_types_id = il.id
    LEFT JOIN archrep.ar_gap_states gs ON g.ar_gap_states_id = gs.id
    LEFT JOIN archrep.ar_adr_statuses st ON g.ar_adr_statuses_id = st.id
    LEFT JOIN archrep.ar_gap_types gt ON g.ar_gap_types_id = gt.id
    ORDER BY g.code`,
  gaps_select_search: `
    SELECT g.id, g.code, g.name, g.description, g.consequences, g.ar_impact_level_types_id, g.remediation_effort,
           g.target_date, g.ar_gap_states_id, g.resolved_date, g.ar_adr_statuses_id, g.ar_gap_types_id, g.source, g.responsible_person,
           g.created_at, g.updated_at,
           il.name as impact_level_name, gs.name as gap_state_name, st.name as adr_status_name, gt.name as gap_type_name
    FROM archrep.ar_gaps g
    LEFT JOIN archrep.ar_impact_level_types il ON g.ar_impact_level_types_id = il.id
    LEFT JOIN archrep.ar_gap_states gs ON g.ar_gap_states_id = gs.id
    LEFT JOIN archrep.ar_adr_statuses st ON g.ar_adr_statuses_id = st.id
    LEFT JOIN archrep.ar_gap_types gt ON g.ar_gap_types_id = gt.id
    WHERE (g.code ILIKE $1 OR g.name ILIKE $1 OR COALESCE(g.description,'') ILIKE $1 OR COALESCE(g.consequences,'') ILIKE $1
      OR COALESCE(g.remediation_effort,'') ILIKE $1 OR COALESCE(g.source,'') ILIKE $1 OR COALESCE(g.responsible_person,'') ILIKE $1
      OR COALESCE(il.name,'') ILIKE $1 OR COALESCE(gs.name,'') ILIKE $1 OR COALESCE(gt.name,'') ILIKE $1)
    ORDER BY g.code`,
  gaps_get: `
    SELECT g.*, il.name as impact_level_name, gs.name as gap_state_name, st.name as adr_status_name, gt.name as gap_type_name
    FROM archrep.ar_gaps g
    LEFT JOIN archrep.ar_impact_level_types il ON g.ar_impact_level_types_id = il.id
    LEFT JOIN archrep.ar_gap_states gs ON g.ar_gap_states_id = gs.id
    LEFT JOIN archrep.ar_adr_statuses st ON g.ar_adr_statuses_id = st.id
    LEFT JOIN archrep.ar_gap_types gt ON g.ar_gap_types_id = gt.id
    WHERE g.id = $1`,
  gaps_insert: `INSERT INTO archrep.ar_gaps (code, name, description, consequences, ar_impact_level_types_id, remediation_effort, target_date, ar_gap_states_id, resolved_date, ar_adr_statuses_id, ar_gap_types_id, source, responsible_person)
    VALUES ($1 || nextval('archrep.ar_gaps_code_seq')::text, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,'')::BIGINT, NULLIF($6,''), NULLIF($7,'')::date, NULLIF($8,'')::BIGINT, NULLIF($9,'')::date, NULLIF($10,'')::BIGINT, NULLIF($11,'')::BIGINT, NULLIF($12,''), NULLIF($13,'')) RETURNING *`,
  gaps_update: `UPDATE archrep.ar_gaps SET name=$1, description=NULLIF($2,''), consequences=NULLIF($3,''), ar_impact_level_types_id=NULLIF($4,'')::BIGINT, remediation_effort=NULLIF($5,''), target_date=NULLIF($6,'')::date, ar_gap_states_id=NULLIF($7,'')::BIGINT, resolved_date=NULLIF($8,'')::date, ar_adr_statuses_id=NULLIF($9,'')::BIGINT, ar_gap_types_id=NULLIF($10,'')::BIGINT, source=NULLIF($11,''), responsible_person=NULLIF($12,''), updated_at=current_timestamp WHERE id=$13 RETURNING *`,
  gaps_delete: `DELETE FROM archrep.ar_gaps WHERE id = $1`,
  gaps_get_by_code: `
    SELECT g.*, il.name as impact_level_name, gs.name as gap_state_name, st.name as adr_status_name, gt.name as gap_type_name
    FROM archrep.ar_gaps g
    LEFT JOIN archrep.ar_impact_level_types il ON g.ar_impact_level_types_id = il.id
    LEFT JOIN archrep.ar_gap_states gs ON g.ar_gap_states_id = gs.id
    LEFT JOIN archrep.ar_adr_statuses st ON g.ar_adr_statuses_id = st.id
    LEFT JOIN archrep.ar_gap_types gt ON g.ar_gap_types_id = gt.id
    WHERE g.code = $1`,

  gap_types_select: `SELECT id, name, description FROM archrep.ar_gap_types ORDER BY name`,
  gap_types_get: `SELECT id, name, description FROM archrep.ar_gap_types WHERE id = $1`,
  gap_types_insert: `INSERT INTO archrep.ar_gap_types (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  gap_types_update: `UPDATE archrep.ar_gap_types SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  gap_types_delete: `DELETE FROM archrep.ar_gap_types WHERE id = $1`,

  impact_level_types_select: `SELECT id, name, description FROM archrep.ar_impact_level_types ORDER BY id`,
  impact_level_types_get: `SELECT id, name, description FROM archrep.ar_impact_level_types WHERE id = $1`,
  impact_level_types_insert: `INSERT INTO archrep.ar_impact_level_types (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  impact_level_types_update: `UPDATE archrep.ar_impact_level_types SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  impact_level_types_delete: `DELETE FROM archrep.ar_impact_level_types WHERE id = $1`,

  gap_states_select: `SELECT id, name, description FROM archrep.ar_gap_states ORDER BY id`,
  gap_states_get: `SELECT id, name, description FROM archrep.ar_gap_states WHERE id = $1`,
  gap_states_insert: `INSERT INTO archrep.ar_gap_states (name, description) VALUES ($1, NULLIF($2,'')) RETURNING *`,
  gap_states_update: `UPDATE archrep.ar_gap_states SET name = $1, description = NULLIF($2,'') WHERE id = $3 RETURNING *`,
  gap_states_delete: `DELETE FROM archrep.ar_gap_states WHERE id = $1`,

  web_resource_statuses_select: `SELECT id, code, name, description FROM archrep.ar_web_resource_statuses ORDER BY id`,
  web_resource_statuses_get: `SELECT id, code, name, description FROM archrep.ar_web_resource_statuses WHERE id = $1`,
  web_resource_statuses_insert: `INSERT INTO archrep.ar_web_resource_statuses (code, name, description) VALUES ($1, NULLIF($2,''), NULLIF($3,'')) RETURNING *`,
  web_resource_statuses_update: `UPDATE archrep.ar_web_resource_statuses SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  web_resource_statuses_delete: `DELETE FROM archrep.ar_web_resource_statuses WHERE id = $1`,

  web_resource_categories_select: `SELECT id, code, name, description FROM archrep.ar_web_resource_categories ORDER BY id`,
  web_resource_categories_get: `SELECT id, code, name, description FROM archrep.ar_web_resource_categories WHERE id = $1`,
  web_resource_categories_insert: `INSERT INTO archrep.ar_web_resource_categories (code, name, description) VALUES ($1, NULLIF($2,''), NULLIF($3,'')) RETURNING *`,
  web_resource_categories_update: `UPDATE archrep.ar_web_resource_categories SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  web_resource_categories_delete: `DELETE FROM archrep.ar_web_resource_categories WHERE id = $1`,

  web_resource_stage_types_select: `SELECT id, code, name, description FROM archrep.ar_web_resource_stage_types ORDER BY id`,
  web_resource_stage_types_get: `SELECT id, code, name, description FROM archrep.ar_web_resource_stage_types WHERE id = $1`,
  web_resource_stage_types_insert: `INSERT INTO archrep.ar_web_resource_stage_types (code, name, description) VALUES ($1, NULLIF($2,''), NULLIF($3,'')) RETURNING *`,
  web_resource_stage_types_update: `UPDATE archrep.ar_web_resource_stage_types SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  web_resource_stage_types_delete: `DELETE FROM archrep.ar_web_resource_stage_types WHERE id = $1`,

  web_resources_system_check: `SELECT id, parent_ar_systems_id FROM archrep.ar_systems WHERE id = $1`,

  web_resources_select: `
    SELECT w.id, w.code, w.short_name, w.purpose, w.publication_url,
           w.ar_systems_id, w.publication_request_number, w.publication_date,
           w.ar_web_resource_statuses_id, w.ar_web_resource_categories_id, w.ar_web_resource_stage_types_id,
           w.ar_domains_id, w.created_at, w.updated_at,
           s.name AS system_name, s.code AS system_code, s.fullname AS system_fullname,
           s.parent_ar_systems_id AS system_parent_id,
           ps.name AS parent_system_name,
           st.name AS status_name, st.code AS status_code,
           cat.name AS category_name, cat.code AS category_code,
           sg.name AS stage_type_name, sg.code AS stage_type_code,
           d.name AS domain_name
    FROM archrep.ar_web_resources w
    JOIN archrep.ar_systems s ON w.ar_systems_id = s.id
    LEFT JOIN archrep.ar_systems ps ON ps.id = s.parent_ar_systems_id
    JOIN archrep.ar_web_resource_statuses st ON w.ar_web_resource_statuses_id = st.id
    JOIN archrep.ar_web_resource_categories cat ON w.ar_web_resource_categories_id = cat.id
    JOIN archrep.ar_web_resource_stage_types sg ON w.ar_web_resource_stage_types_id = sg.id
    LEFT JOIN archrep.ar_domains d ON w.ar_domains_id = d.id
    ORDER BY w.code`,
  web_resources_select_search: `
    SELECT w.id, w.code, w.short_name, w.purpose, w.publication_url,
           w.ar_systems_id, w.publication_request_number, w.publication_date,
           w.ar_web_resource_statuses_id, w.ar_web_resource_categories_id, w.ar_web_resource_stage_types_id,
           w.ar_domains_id, w.created_at, w.updated_at,
           s.name AS system_name, s.code AS system_code, s.fullname AS system_fullname,
           s.parent_ar_systems_id AS system_parent_id,
           ps.name AS parent_system_name,
           st.name AS status_name, st.code AS status_code,
           cat.name AS category_name, cat.code AS category_code,
           sg.name AS stage_type_name, sg.code AS stage_type_code,
           d.name AS domain_name
    FROM archrep.ar_web_resources w
    JOIN archrep.ar_systems s ON w.ar_systems_id = s.id
    LEFT JOIN archrep.ar_systems ps ON ps.id = s.parent_ar_systems_id
    JOIN archrep.ar_web_resource_statuses st ON w.ar_web_resource_statuses_id = st.id
    JOIN archrep.ar_web_resource_categories cat ON w.ar_web_resource_categories_id = cat.id
    JOIN archrep.ar_web_resource_stage_types sg ON w.ar_web_resource_stage_types_id = sg.id
    LEFT JOIN archrep.ar_domains d ON w.ar_domains_id = d.id
    WHERE (
      w.code ILIKE $1 OR w.short_name ILIKE $1 OR COALESCE(w.purpose,'') ILIKE $1
      OR COALESCE(w.publication_url,'') ILIKE $1
      OR COALESCE(w.publication_request_number,'') ILIKE $1
      OR s.name ILIKE $1 OR COALESCE(s.code,'') ILIKE $1 OR COALESCE(s.fullname,'') ILIKE $1
      OR COALESCE(ps.name,'') ILIKE $1
      OR st.name ILIKE $1 OR COALESCE(st.code,'') ILIKE $1
      OR cat.name ILIKE $1 OR COALESCE(cat.code,'') ILIKE $1
      OR sg.name ILIKE $1 OR COALESCE(sg.code,'') ILIKE $1
      OR COALESCE(d.name,'') ILIKE $1
    )
    ORDER BY w.code`,
  web_resources_get: `
    SELECT w.id, w.code, w.short_name, w.purpose, w.publication_url,
           w.ar_systems_id, w.publication_request_number, w.publication_date,
           w.ar_web_resource_statuses_id, w.ar_web_resource_categories_id, w.ar_web_resource_stage_types_id,
           w.ar_domains_id, w.created_at, w.updated_at,
           s.name AS system_name, s.code AS system_code, s.fullname AS system_fullname,
           s.parent_ar_systems_id AS system_parent_id,
           ps.name AS parent_system_name,
           st.name AS status_name, st.code AS status_code,
           cat.name AS category_name, cat.code AS category_code,
           sg.name AS stage_type_name, sg.code AS stage_type_code,
           d.name AS domain_name
    FROM archrep.ar_web_resources w
    JOIN archrep.ar_systems s ON w.ar_systems_id = s.id
    LEFT JOIN archrep.ar_systems ps ON ps.id = s.parent_ar_systems_id
    JOIN archrep.ar_web_resource_statuses st ON w.ar_web_resource_statuses_id = st.id
    JOIN archrep.ar_web_resource_categories cat ON w.ar_web_resource_categories_id = cat.id
    JOIN archrep.ar_web_resource_stage_types sg ON w.ar_web_resource_stage_types_id = sg.id
    LEFT JOIN archrep.ar_domains d ON w.ar_domains_id = d.id
    WHERE w.id = $1`,
  web_resources_get_by_code: `
    SELECT w.id, w.code, w.short_name, w.purpose, w.publication_url,
           w.ar_systems_id, w.publication_request_number, w.publication_date,
           w.ar_web_resource_statuses_id, w.ar_web_resource_categories_id, w.ar_web_resource_stage_types_id,
           w.ar_domains_id, w.created_at, w.updated_at,
           s.name AS system_name, s.code AS system_code, s.fullname AS system_fullname,
           s.parent_ar_systems_id AS system_parent_id,
           ps.name AS parent_system_name,
           st.name AS status_name, st.code AS status_code,
           cat.name AS category_name, cat.code AS category_code,
           sg.name AS stage_type_name, sg.code AS stage_type_code,
           d.name AS domain_name
    FROM archrep.ar_web_resources w
    JOIN archrep.ar_systems s ON w.ar_systems_id = s.id
    LEFT JOIN archrep.ar_systems ps ON ps.id = s.parent_ar_systems_id
    JOIN archrep.ar_web_resource_statuses st ON w.ar_web_resource_statuses_id = st.id
    JOIN archrep.ar_web_resource_categories cat ON w.ar_web_resource_categories_id = cat.id
    JOIN archrep.ar_web_resource_stage_types sg ON w.ar_web_resource_stage_types_id = sg.id
    LEFT JOIN archrep.ar_domains d ON w.ar_domains_id = d.id
    WHERE w.code = $1`,
  systems_select_for_import_labels: `
    SELECT s.id, s.code, s.name,
      COALESCE(NULLIF(TRIM(s.name), ''), s.code, '') AS import_label
    FROM archrep.ar_systems s
    ORDER BY import_label`,
  web_resources_insert: `INSERT INTO archrep.ar_web_resources (
      code, short_name, purpose, publication_url,
      ar_systems_id, publication_request_number, publication_date,
      ar_web_resource_statuses_id, ar_web_resource_categories_id, ar_web_resource_stage_types_id,
      ar_domains_id
    ) VALUES (
      $1 || nextval('archrep.ar_web_resources_code_seq')::text,
      $2, NULLIF($3,''), NULLIF($4,''),
      $5::BIGINT, NULLIF($6,''), NULLIF($7,'')::date,
      $8::BIGINT, $9::BIGINT, $10::BIGINT,
      NULLIF($11,'')::BIGINT
    ) RETURNING *`,
  web_resources_update: `UPDATE archrep.ar_web_resources SET
      short_name = $1, purpose = NULLIF($2,''), publication_url = NULLIF($3,''),
      ar_systems_id = $4::BIGINT, publication_request_number = NULLIF($5,''),
      publication_date = NULLIF($6,'')::date, ar_web_resource_statuses_id = $7::BIGINT,
      ar_web_resource_categories_id = $8::BIGINT, ar_web_resource_stage_types_id = $9::BIGINT,
      ar_domains_id = NULLIF($10,'')::BIGINT,
      updated_at = current_timestamp
    WHERE id = $11 RETURNING *`,
  web_resources_delete: `DELETE FROM archrep.ar_web_resources WHERE id = $1`,

  domain_statuses_select: `SELECT id, code, name, description FROM archrep.ar_domain_statuses ORDER BY id`,
  domain_statuses_get: `SELECT id, code, name, description FROM archrep.ar_domain_statuses WHERE id = $1`,
  domain_statuses_insert: `INSERT INTO archrep.ar_domain_statuses (code, name, description) VALUES ($1, NULLIF($2,''), NULLIF($3,'')) RETURNING *`,
  domain_statuses_update: `UPDATE archrep.ar_domain_statuses SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  domain_statuses_delete: `DELETE FROM archrep.ar_domain_statuses WHERE id = $1`,
  domain_statuses_get_by_code: `SELECT id, code, name, description FROM archrep.ar_domain_statuses WHERE code = $1`,

  domains_select: `
    SELECT d.id, d.name, d.registrar_ar_partners_id, d.registered_at, d.expires_at,
           d.ar_domain_statuses_id, d.purpose, d.company_ar_organization_units_id,
           d.business_owner_ar_employees_id, d.created_at, d.updated_at,
           st.name AS status_name, st.code AS status_code,
           p.name AS registrar_name,
           o.name AS company_name,
           e.full_name AS business_owner_name
    FROM archrep.ar_domains d
    JOIN archrep.ar_domain_statuses st ON d.ar_domain_statuses_id = st.id
    LEFT JOIN archrep.ar_partners p ON d.registrar_ar_partners_id = p.id
    LEFT JOIN archrep.ar_organization_units o ON d.company_ar_organization_units_id = o.id
    LEFT JOIN archrep.ar_employees e ON d.business_owner_ar_employees_id = e.id
    ORDER BY d.name`,
  domains_select_search: `
    SELECT d.id, d.name, d.registrar_ar_partners_id, d.registered_at, d.expires_at,
           d.ar_domain_statuses_id, d.purpose, d.company_ar_organization_units_id,
           d.business_owner_ar_employees_id, d.created_at, d.updated_at,
           st.name AS status_name, st.code AS status_code,
           p.name AS registrar_name,
           o.name AS company_name,
           e.full_name AS business_owner_name
    FROM archrep.ar_domains d
    JOIN archrep.ar_domain_statuses st ON d.ar_domain_statuses_id = st.id
    LEFT JOIN archrep.ar_partners p ON d.registrar_ar_partners_id = p.id
    LEFT JOIN archrep.ar_organization_units o ON d.company_ar_organization_units_id = o.id
    LEFT JOIN archrep.ar_employees e ON d.business_owner_ar_employees_id = e.id
    WHERE (
      d.name ILIKE $1 OR COALESCE(d.purpose,'') ILIKE $1
      OR st.name ILIKE $1 OR COALESCE(st.code,'') ILIKE $1
      OR COALESCE(p.name,'') ILIKE $1
      OR COALESCE(o.name,'') ILIKE $1
      OR COALESCE(e.full_name,'') ILIKE $1
    )
    ORDER BY d.name`,
  domains_get: `
    SELECT d.id, d.name, d.registrar_ar_partners_id, d.registered_at, d.expires_at,
           d.ar_domain_statuses_id, d.purpose, d.company_ar_organization_units_id,
           d.business_owner_ar_employees_id, d.created_at, d.updated_at,
           st.name AS status_name, st.code AS status_code,
           p.name AS registrar_name,
           o.name AS company_name,
           e.full_name AS business_owner_name
    FROM archrep.ar_domains d
    JOIN archrep.ar_domain_statuses st ON d.ar_domain_statuses_id = st.id
    LEFT JOIN archrep.ar_partners p ON d.registrar_ar_partners_id = p.id
    LEFT JOIN archrep.ar_organization_units o ON d.company_ar_organization_units_id = o.id
    LEFT JOIN archrep.ar_employees e ON d.business_owner_ar_employees_id = e.id
    WHERE d.id = $1`,
  domains_get_by_name: `
    SELECT d.id, d.name, d.ar_domain_statuses_id
    FROM archrep.ar_domains d
    WHERE lower(trim(d.name)) = lower(trim($1))
    LIMIT 1`,
  domains_insert: `
    INSERT INTO archrep.ar_domains (
      name, registrar_ar_partners_id, registered_at, expires_at, ar_domain_statuses_id,
      purpose, company_ar_organization_units_id, business_owner_ar_employees_id
    ) VALUES (
      lower(trim($1)), NULLIF($2,'')::BIGINT, NULLIF($3,'')::date, NULLIF($4,'')::date, $5::BIGINT,
      NULLIF($6,''), NULLIF($7,'')::BIGINT, NULLIF($8,'')::BIGINT
    ) RETURNING *`,
  domains_update: `
    UPDATE archrep.ar_domains SET
      name = lower(trim($1)),
      registrar_ar_partners_id = NULLIF($2,'')::BIGINT,
      registered_at = NULLIF($3,'')::date,
      expires_at = NULLIF($4,'')::date,
      ar_domain_statuses_id = $5::BIGINT,
      purpose = NULLIF($6,''),
      company_ar_organization_units_id = NULLIF($7,'')::BIGINT,
      business_owner_ar_employees_id = NULLIF($8,'')::BIGINT,
      updated_at = current_timestamp
    WHERE id = $9 RETURNING *`,
  domains_delete: `DELETE FROM archrep.ar_domains WHERE id = $1`,
  domains_count_web_resources: `SELECT COUNT(*)::int AS c FROM archrep.ar_web_resources WHERE ar_domains_id = $1`,
  domains_org_unit_is_org: `
    SELECT o.id
    FROM archrep.ar_organization_units o
    JOIN archrep.ar_organization_unit_categories c ON o.organization_unit_categories_id = c.id
    WHERE o.id = $1 AND c.code = 'org'`,
  organization_units_select_org_only: `
    SELECT o.id, o.name, o.fullname, o.parent_id, o.description, o.leader, o.organization_unit_categories_id,
           o.created_at, o.updated_at, c.name as category_name, c.code as category_code
    FROM archrep.ar_organization_units o
    JOIN archrep.ar_organization_unit_categories c ON o.organization_unit_categories_id = c.id
    WHERE c.code = 'org'
    ORDER BY o.name`,
  certificates_select: `
    SELECT c.id, c.code, c.ar_domains_id, c.ca_ar_partners_id, c.issued_at, c.expires_at,
           c.wildcard_flag, c.placement_url, c.responsible_ar_employees_id, c.created_at, c.updated_at,
           d.name AS domain_name, p.name AS ca_name, e.full_name AS responsible_name
    FROM archrep.ar_certificates c
    JOIN archrep.ar_domains d ON c.ar_domains_id = d.id
    LEFT JOIN archrep.ar_partners p ON c.ca_ar_partners_id = p.id
    LEFT JOIN archrep.ar_employees e ON c.responsible_ar_employees_id = e.id
    ORDER BY c.expires_at NULLS LAST, c.code`,
  certificates_select_search: `
    SELECT c.id, c.code, c.ar_domains_id, c.ca_ar_partners_id, c.issued_at, c.expires_at,
           c.wildcard_flag, c.placement_url, c.responsible_ar_employees_id, c.created_at, c.updated_at,
           d.name AS domain_name, p.name AS ca_name, e.full_name AS responsible_name
    FROM archrep.ar_certificates c
    JOIN archrep.ar_domains d ON c.ar_domains_id = d.id
    LEFT JOIN archrep.ar_partners p ON c.ca_ar_partners_id = p.id
    LEFT JOIN archrep.ar_employees e ON c.responsible_ar_employees_id = e.id
    WHERE (
      c.code ILIKE $1
      OR d.name ILIKE $1
      OR COALESCE(p.name, '') ILIKE $1
      OR COALESCE(e.full_name, '') ILIKE $1
      OR COALESCE(c.placement_url, '') ILIKE $1
    )
    ORDER BY c.expires_at NULLS LAST, c.code`,
  certificates_get: `
    SELECT c.id, c.code, c.ar_domains_id, c.ca_ar_partners_id, c.issued_at, c.expires_at,
           c.wildcard_flag, c.placement_url, c.responsible_ar_employees_id, c.created_at, c.updated_at,
           d.name AS domain_name, p.name AS ca_name, e.full_name AS responsible_name
    FROM archrep.ar_certificates c
    JOIN archrep.ar_domains d ON c.ar_domains_id = d.id
    LEFT JOIN archrep.ar_partners p ON c.ca_ar_partners_id = p.id
    LEFT JOIN archrep.ar_employees e ON c.responsible_ar_employees_id = e.id
    WHERE c.id = $1`,
  certificates_get_by_code: `
    SELECT c.id, c.code, c.ar_domains_id, c.ca_ar_partners_id, c.issued_at, c.expires_at,
           c.wildcard_flag, c.placement_url, c.responsible_ar_employees_id, c.created_at, c.updated_at,
           d.name AS domain_name, p.name AS ca_name, e.full_name AS responsible_name
    FROM archrep.ar_certificates c
    JOIN archrep.ar_domains d ON c.ar_domains_id = d.id
    LEFT JOIN archrep.ar_partners p ON c.ca_ar_partners_id = p.id
    LEFT JOIN archrep.ar_employees e ON c.responsible_ar_employees_id = e.id
    WHERE lower(trim(c.code)) = lower(trim($1))
    LIMIT 1`,
  certificates_insert: `
    INSERT INTO archrep.ar_certificates (
      ar_domains_id, ca_ar_partners_id, issued_at, expires_at, wildcard_flag, placement_url, responsible_ar_employees_id
    ) VALUES (
      $1::BIGINT, NULLIF($2,'')::BIGINT, $3::date, $4::date, COALESCE($5, false), NULLIF($6,''), NULLIF($7,'')::BIGINT
    ) RETURNING *`,
  certificates_update: `
    UPDATE archrep.ar_certificates SET
      ar_domains_id = $1::BIGINT,
      ca_ar_partners_id = NULLIF($2,'')::BIGINT,
      issued_at = $3::date,
      expires_at = $4::date,
      wildcard_flag = COALESCE($5, false),
      placement_url = NULLIF($6,''),
      responsible_ar_employees_id = NULLIF($7,'')::BIGINT,
      updated_at = current_timestamp
    WHERE id = $8
    RETURNING *`,
  certificates_delete: `DELETE FROM archrep.ar_certificates WHERE id = $1`,
  certificates_select_pending_placement_notify: `
    SELECT c.id, c.code, c.ar_domains_id, c.placement_url, c.issued_at, c.expires_at,
           c.wildcard_flag, d.name AS domain_name, p.name AS ca_name,
           e.email AS responsible_email, e.full_name AS responsible_name
    FROM archrep.ar_certificates c
    JOIN archrep.ar_domains d ON c.ar_domains_id = d.id
    LEFT JOIN archrep.ar_partners p ON c.ca_ar_partners_id = p.id
    LEFT JOIN archrep.ar_employees e ON c.responsible_ar_employees_id = e.id
    WHERE trim(coalesce(c.placement_url, '')) <> ''
      AND (
        c.placement_notified_url IS NULL
        OR trim(c.placement_notified_url) <> trim(c.placement_url)
      )
    ORDER BY c.id`,
  certificates_select_published_web_resources_by_domain: `
    SELECT w.id, w.code, w.short_name, w.publication_url,
           s.name AS system_name,
           CASE WHEN s.parent_ar_systems_id IS NOT NULL THEN s.name ELSE NULL END AS module_name,
           COALESCE(root.name, s.name) AS root_system_name,
           it_e.full_name AS it_lead_name
    FROM archrep.ar_web_resources w
    JOIN archrep.ar_web_resource_statuses st ON w.ar_web_resource_statuses_id = st.id
    JOIN archrep.ar_systems s ON w.ar_systems_id = s.id
    LEFT JOIN archrep.ar_systems root ON root.id = COALESCE(s.parent_ar_systems_id, s.id)
    LEFT JOIN archrep.ar_employees it_e ON s.it_lead_employee_id = it_e.id
    WHERE w.ar_domains_id = $1::BIGINT
      AND st.code = 'published'
    ORDER BY root_system_name, module_name NULLS FIRST, w.code`,
  certificates_mark_placement_notified: `
    UPDATE archrep.ar_certificates
    SET placement_notified_at = now(),
        placement_notified_url = placement_url,
        updated_at = now()
    WHERE id = $1::BIGINT`,
  certificates_count_relations: `
    SELECT COUNT(*)::int AS c
    FROM archrep.ar_metamodel_relations
    WHERE from_entity_type = 'certificate' AND from_entity_id = $1`,
  web_resources_select_urls_for_domain_rebuild: `
    SELECT id, publication_url, ar_domains_id
    FROM archrep.ar_web_resources
    WHERE COALESCE(TRIM(publication_url), '') <> ''`,
  web_resources_set_domain_id: `
    UPDATE archrep.ar_web_resources
    SET ar_domains_id = $2::BIGINT, updated_at = current_timestamp
    WHERE id = $1`,

  metamodel_relations_by_from: `
    SELECT r.id, r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id, r.relation_type, r.name, r.displayed_name, r.reference_to_baserow, r.description, r.payload, r.created_at, r.updated_at,
           rrt.name AS relation_type_name
    FROM archrep.ar_metamodel_relations r
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    WHERE r.from_entity_type = $1 AND r.from_entity_id = $2
    ORDER BY r.id`,
  // Обратное направление (кто ссылается на сущность) — для инструмента ИИ-архитектора `get_relations`
  // (docs/ai-architect.md §6.2): без него «анализ зависимостей» видел бы только исходящие рёбра.
  metamodel_relations_by_to: `
    SELECT r.id, r.from_entity_type, r.from_entity_id, r.to_entity_type, r.to_entity_id, r.relation_type, r.name, r.displayed_name, r.reference_to_baserow, r.description, r.payload, r.created_at, r.updated_at,
           rrt.name AS relation_type_name
    FROM archrep.ar_metamodel_relations r
    LEFT JOIN archrep.ar_metamodel_entity_types rfe ON rfe.code = r.from_entity_type
    LEFT JOIN archrep.ar_metamodel_entity_types rte ON rte.code = r.to_entity_type
    LEFT JOIN archrep.ar_metamodel_relation_types rrt
      ON rrt.code = r.relation_type
     AND rrt.from_entity_type_id = rfe.id
     AND rrt.to_entity_type_id = rte.id
    WHERE r.to_entity_type = $1 AND r.to_entity_id = $2
    ORDER BY r.id`,

  settings_parameters_select: `SELECT id, code, description, value, value_type, "group", is_secret, read_only, updated_at FROM archrep.ar_settings_parameters ORDER BY "group" NULLS FIRST, code`,
  settings_parameters_select_search: `SELECT id, code, description, value, value_type, "group", is_secret, read_only, updated_at FROM archrep.ar_settings_parameters WHERE code ILIKE $1 OR COALESCE(description,'') ILIKE $1 OR COALESCE("group",'') ILIKE $1 ORDER BY "group" NULLS FIRST, code`,
  settings_parameters_get: `SELECT id, code, description, value, value_type, "group", is_secret, read_only, created_at, updated_at FROM archrep.ar_settings_parameters WHERE id = $1`,
  settings_parameters_get_by_code: `SELECT id, code, description, value, value_type, "group", is_secret, read_only, created_at, updated_at FROM archrep.ar_settings_parameters WHERE code = $1`,
  settings_parameters_insert: `INSERT INTO archrep.ar_settings_parameters (code, description, value, value_type, "group", is_secret, read_only) VALUES ($1, NULLIF($2,''), NULLIF($3,''), COALESCE(NULLIF($4,''), 'string'), NULLIF($5,''), COALESCE($6, false), COALESCE($7, false)) RETURNING *`,
  settings_parameters_update: `UPDATE archrep.ar_settings_parameters SET description = NULLIF($2,''), value = $3, value_type = COALESCE(NULLIF($4,''), 'string'), "group" = NULLIF($5,''), is_secret = COALESCE($6, false), read_only = COALESCE($7, false), updated_at = now() WHERE id = $1 RETURNING *`,
  settings_parameters_delete: `DELETE FROM archrep.ar_settings_parameters WHERE id = $1`,

  jobs_select: `
    SELECT j.id, j.code, j.name, j.description, j.handler, j.interval_seconds, j.enabled,
           j.last_started_at, j.last_finished_at, j.last_success_at, j.last_status,
           j.created_at, j.updated_at
    FROM archrep.ar_jobs j
    ORDER BY j.name`,
  jobs_get: `
    SELECT j.id, j.code, j.name, j.description, j.handler, j.interval_seconds, j.enabled,
           j.last_started_at, j.last_finished_at, j.last_success_at, j.last_status,
           j.created_at, j.updated_at
    FROM archrep.ar_jobs j
    WHERE j.id = $1`,
  jobs_get_by_code: `
    SELECT j.id, j.code, j.name, j.description, j.handler, j.interval_seconds, j.enabled,
           j.last_started_at, j.last_finished_at, j.last_success_at, j.last_status
    FROM archrep.ar_jobs j
    WHERE j.code = $1`,
  jobs_select_due: `
    SELECT j.id, j.code, j.name, j.description, j.handler, j.interval_seconds, j.enabled,
           j.last_started_at, j.last_finished_at, j.last_success_at, j.last_status
    FROM archrep.ar_jobs j
    WHERE j.enabled = true
      AND NOT (
        j.last_status = 'running'
        AND j.last_started_at IS NOT NULL
        AND j.last_started_at > now() - interval '15 minutes'
      )
      AND COALESCE(
        j.last_success_at,
        j.last_finished_at,
        j.last_started_at,
        to_timestamp(0)
      ) <= now() - (
        CASE
          WHEN j.code = 'certificate_placement_notify' THEN GREATEST(
            3600,
            COALESCE(
              NULLIF(trim((
                SELECT sp.value FROM archrep.ar_settings_parameters sp
                WHERE sp.code = 'CHK_CERT_PLACEMENT_INTERVAL_SECONDS'
                LIMIT 1
              )), '')::int,
              j.interval_seconds
            )
          )
          ELSE j.interval_seconds
        END
      ) * interval '1 second'
    ORDER BY j.id`,
  jobs_update_enabled: `
    UPDATE archrep.ar_jobs
    SET enabled = $2, updated_at = now()
    WHERE id = $1
    RETURNING *`,
  jobs_touch_start: `
    UPDATE archrep.ar_jobs
    SET last_started_at = now(), last_status = 'running', updated_at = now()
    WHERE id = $1`,
  jobs_touch_finish_success: `
    UPDATE archrep.ar_jobs
    SET last_finished_at = now(),
        last_status = 'success',
        last_success_at = now(),
        updated_at = now()
    WHERE id = $1
    RETURNING id, last_success_at, last_status`,
  jobs_touch_finish_failed: `
    UPDATE archrep.ar_jobs
    SET last_finished_at = now(),
        last_status = 'failed',
        updated_at = now()
    WHERE id = $1`,
  job_runs_insert: `
    INSERT INTO archrep.ar_job_runs (job_id, status, run_trigger, triggered_by_user_id)
    VALUES ($1, 'running', $2, $3)
    RETURNING *`,
  job_runs_finish: `
    UPDATE archrep.ar_job_runs
    SET finished_at = now(),
        status = $2,
        message = $3,
        error_message = $4,
        result_json = $5
    WHERE id = $1
    RETURNING *`,
  job_runs_select_by_job: `
    SELECT r.id, r.job_id, r.started_at, r.finished_at, r.status, r.run_trigger AS trigger,
           r.message, r.error_message, r.result_json, r.triggered_by_user_id,
           u.login AS triggered_by_login
    FROM archrep.ar_job_runs r
    LEFT JOIN archrep.ar_app_users u ON u.id = r.triggered_by_user_id
    WHERE r.job_id = $1
    ORDER BY r.started_at DESC
    LIMIT $2 OFFSET $3`,
  domains_select_expiring: `
    SELECT d.id, d.name, d.expires_at,
           st.name AS status_name, st.code AS status_code,
           p.name AS registrar_name,
           e.full_name AS business_owner_name
    FROM archrep.ar_domains d
    JOIN archrep.ar_domain_statuses st ON d.ar_domain_statuses_id = st.id
    LEFT JOIN archrep.ar_partners p ON d.registrar_ar_partners_id = p.id
    LEFT JOIN archrep.ar_employees e ON d.business_owner_ar_employees_id = e.id
    WHERE d.expires_at IS NOT NULL
      AND d.expires_at >= CURRENT_DATE
      AND d.expires_at <= CURRENT_DATE + $1::int
      AND st.code <> 'rejected'
    ORDER BY d.expires_at, d.name`,
  certificates_select_expiring: `
    SELECT c.id, c.code, c.expires_at,
           d.name AS domain_name,
           e.full_name AS responsible_name
    FROM archrep.ar_certificates c
    JOIN archrep.ar_domains d ON c.ar_domains_id = d.id
    LEFT JOIN archrep.ar_employees e ON c.responsible_ar_employees_id = e.id
    WHERE c.expires_at IS NOT NULL
      AND c.expires_at >= CURRENT_DATE
      AND c.expires_at <= CURRENT_DATE + $1::int
    ORDER BY c.expires_at, c.code`,

  // --- Инфраструктура (Netbox, read-only) ---
  infrastructure_object_types_select: `SELECT id, code, name, description FROM archrep.ar_infrastructure_object_types ORDER BY id`,
  infrastructure_object_types_select_search: `
    SELECT id, code, name, description
    FROM archrep.ar_infrastructure_object_types
    WHERE code ILIKE $1 OR name ILIKE $1 OR COALESCE(description, '') ILIKE $1
    ORDER BY id`,
  infrastructure_object_types_get: `SELECT id, code, name, description FROM archrep.ar_infrastructure_object_types WHERE id = $1`,
  infrastructure_object_types_insert: `INSERT INTO archrep.ar_infrastructure_object_types (code, name, description) VALUES ($1, NULLIF($2,''), NULLIF($3,'')) RETURNING *`,
  infrastructure_object_types_update: `UPDATE archrep.ar_infrastructure_object_types SET code = $1, name = $2, description = NULLIF($3,'') WHERE id = $4 RETURNING *`,
  infrastructure_object_types_delete: `DELETE FROM archrep.ar_infrastructure_object_types WHERE id = $1`,

  infrastructure_objects_select: `
    SELECT o.id, o.source, o.external_id, o.ar_infrastructure_object_types_id,
           o.name, o.description, o.primary_ip, o.status, o.site, o.cluster, o.platform, o.tenant,
           o.vcpus, o.memory_gb, o.disk_gb, o.netbox_updated_at, o.synced_at,
           COALESCE((
             SELECT jsonb_agg(tag->>'name')
             FROM jsonb_array_elements(COALESCE(o.payload->'tags', '[]'::jsonb)) AS tag
             WHERE tag->>'name' IS NOT NULL
           ), '[]'::jsonb) AS tag_names,
           t.code AS type_code, t.name AS type_name,
           COALESCE((
             SELECT string_agg(DISTINCT s.name, ', ' ORDER BY s.name)
             FROM archrep.ar_metamodel_relations r
             JOIN archrep.ar_systems s ON s.id = r.from_entity_id
             WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
               AND r.from_entity_type IN ('system', 'subsystem')
               AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           ), '') AS system_names,
           (
             SELECT COUNT(*)::int
             FROM archrep.ar_metamodel_relations r
             WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
               AND r.from_entity_type IN ('system', 'subsystem')
               AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           ) AS system_count
    FROM archrep.ar_infrastructure_objects o
    JOIN archrep.ar_infrastructure_object_types t ON t.id = o.ar_infrastructure_object_types_id
    ORDER BY o.name`,

  infrastructure_objects_select_search: `
    SELECT o.id, o.source, o.external_id, o.ar_infrastructure_object_types_id,
           o.name, o.description, o.primary_ip, o.status, o.site, o.cluster, o.platform, o.tenant,
           o.vcpus, o.memory_gb, o.disk_gb, o.netbox_updated_at, o.synced_at,
           COALESCE((
             SELECT jsonb_agg(tag->>'name')
             FROM jsonb_array_elements(COALESCE(o.payload->'tags', '[]'::jsonb)) AS tag
             WHERE tag->>'name' IS NOT NULL
           ), '[]'::jsonb) AS tag_names,
           t.code AS type_code, t.name AS type_name,
           COALESCE((
             SELECT string_agg(DISTINCT s.name, ', ' ORDER BY s.name)
             FROM archrep.ar_metamodel_relations r
             JOIN archrep.ar_systems s ON s.id = r.from_entity_id
             WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
               AND r.from_entity_type IN ('system', 'subsystem')
               AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           ), '') AS system_names,
           (
             SELECT COUNT(*)::int
             FROM archrep.ar_metamodel_relations r
             WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
               AND r.from_entity_type IN ('system', 'subsystem')
               AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           ) AS system_count
    FROM archrep.ar_infrastructure_objects o
    JOIN archrep.ar_infrastructure_object_types t ON t.id = o.ar_infrastructure_object_types_id
    WHERE o.name ILIKE $1
       OR COALESCE(o.description, '') ILIKE $1
       OR COALESCE(o.primary_ip, '') ILIKE $1
       OR COALESCE(o.status, '') ILIKE $1
       OR COALESCE(o.site, '') ILIKE $1
       OR COALESCE(o.cluster, '') ILIKE $1
       OR COALESCE(o.platform, '') ILIKE $1
       OR COALESCE(o.tenant, '') ILIKE $1
       OR t.name ILIKE $1
       OR t.code ILIKE $1
       OR EXISTS (
         SELECT 1
         FROM archrep.ar_metamodel_relations r
         JOIN archrep.ar_systems s ON s.id = r.from_entity_id
         WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
           AND r.from_entity_type IN ('system', 'subsystem')
           AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           AND (s.name ILIKE $1 OR s.code ILIKE $1)
       )
    ORDER BY o.name`,

  infrastructure_objects_get: `
    SELECT o.id, o.source, o.external_id, o.ar_infrastructure_object_types_id,
           o.name, o.description, o.primary_ip, o.status, o.site, o.cluster, o.platform, o.tenant,
           o.vcpus, o.memory_gb, o.disk_gb, o.netbox_updated_at, o.synced_at,
           COALESCE((
             SELECT jsonb_agg(tag->>'name')
             FROM jsonb_array_elements(COALESCE(o.payload->'tags', '[]'::jsonb)) AS tag
             WHERE tag->>'name' IS NOT NULL
           ), '[]'::jsonb) AS tag_names,
           t.code AS type_code, t.name AS type_name,
           COALESCE((
             SELECT string_agg(DISTINCT s.name, ', ' ORDER BY s.name)
             FROM archrep.ar_metamodel_relations r
             JOIN archrep.ar_systems s ON s.id = r.from_entity_id
             WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
               AND r.from_entity_type IN ('system', 'subsystem')
               AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           ), '') AS system_names,
           (
             SELECT COUNT(*)::int
             FROM archrep.ar_metamodel_relations r
             WHERE r.to_entity_type = 'infrastructure_object' AND r.to_entity_id = o.id
               AND r.from_entity_type IN ('system', 'subsystem')
               AND r.relation_type IN ('system_infrastructure', 'subsystem_infrastructure')
           ) AS system_count
    FROM archrep.ar_infrastructure_objects o
    JOIN archrep.ar_infrastructure_object_types t ON t.id = o.ar_infrastructure_object_types_id
    WHERE o.id = $1`,


  infrastructure_objects_label_select: `
    SELECT o.id, o.name, o.primary_ip, o.status, o.site, t.name AS type_name
    FROM archrep.ar_infrastructure_objects o
    JOIN archrep.ar_infrastructure_object_types t ON t.id = o.ar_infrastructure_object_types_id
    ORDER BY o.name`,
  infrastructure_objects_upsert: `
    INSERT INTO archrep.ar_infrastructure_objects (
      source, external_id, ar_infrastructure_object_types_id, name, description, primary_ip,
      status, site, cluster, platform, tenant, vcpus, memory_gb, disk_gb,
      netbox_updated_at, synced_at, payload
    ) VALUES (
      $1, $2, $3, $4, NULLIF($5,''), NULLIF($6,''), NULLIF($7,''), NULLIF($8,''),
      NULLIF($9,''), NULLIF($10,''), NULLIF($11,''), $12, $13, $14, $15, $16, $17::jsonb
    )
    ON CONFLICT (source, ar_infrastructure_object_types_id, external_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      primary_ip = EXCLUDED.primary_ip,
      status = EXCLUDED.status,
      site = EXCLUDED.site,
      cluster = EXCLUDED.cluster,
      platform = EXCLUDED.platform,
      tenant = EXCLUDED.tenant,
      vcpus = EXCLUDED.vcpus,
      memory_gb = EXCLUDED.memory_gb,
      disk_gb = EXCLUDED.disk_gb,
      netbox_updated_at = EXCLUDED.netbox_updated_at,
      synced_at = EXCLUDED.synced_at,
      payload = EXCLUDED.payload
    RETURNING id, (xmax = 0) AS inserted`,
  infrastructure_objects_delete_stale: `
    DELETE FROM archrep.ar_infrastructure_objects
    WHERE source = $1
      AND ar_infrastructure_object_types_id = $2
      AND synced_at < $3`,
  infrastructure_systems_map_select: `
    SELECT id, code, parent_ar_systems_id
    FROM archrep.ar_systems
    ORDER BY id`,
  metamodel_relations_delete_infrastructure_object: `
    DELETE FROM archrep.ar_metamodel_relations
    WHERE to_entity_type = 'infrastructure_object'
      AND to_entity_id = $1
      AND relation_type IN ('system_infrastructure', 'subsystem_infrastructure')`,


};
