-- DROP SCHEMA archrep_test;

CREATE SCHEMA archrep_test AUTHORIZATION postgres;
-- archrep_test.ar_classificators определение

-- Drop table

-- DROP TABLE archrep_test.ar_classificators;

CREATE TABLE archrep_test.ar_classificators (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование классификатора
	CONSTRAINT ar_classificators_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_classificators."name" IS 'Наименование классификатора';


-- archrep_test.ar_partners определение

-- Drop table

-- DROP TABLE archrep_test.ar_partners;

CREATE TABLE archrep_test.ar_partners (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование компании партнера (вендор, разработчик, интегратор, партнер по поддержке)
	CONSTRAINT ar_partners_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_partners."name" IS 'Наименование компании партнера (вендор, разработчик, интегратор, партнер по поддержке)';


-- archrep_test.ar_principles определение

-- Drop table

-- DROP TABLE archrep_test.ar_principles;

CREATE TABLE archrep_test.ar_principles (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование архитектурного принципа
	"statement" varchar NULL, -- Утверждение - основной тезис принципа
	rationale varchar NULL, -- Обоснование того, почему этот принцип важен
	implications varchar NULL, -- Применение - описывает порядок применения принципа
	is_approved bool DEFAULT false NULL,
	approve_document varchar NULL, -- Документ, которым утвержден данный принцип
	CONSTRAINT ar_principles_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_principles."name" IS 'Наименование архитектурного принципа';
COMMENT ON COLUMN archrep_test.ar_principles."statement" IS 'Утверждение - основной тезис принципа';
COMMENT ON COLUMN archrep_test.ar_principles.rationale IS 'Обоснование того, почему этот принцип важен';
COMMENT ON COLUMN archrep_test.ar_principles.implications IS 'Применение - описывает порядок применения принципа';
COMMENT ON COLUMN archrep_test.ar_principles.approve_document IS 'Документ, которым утвержден данный принцип';


-- archrep_test.ar_system_assignments определение

-- Drop table

-- DROP TABLE archrep_test.ar_system_assignments;

CREATE TABLE archrep_test.ar_system_assignments (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование
	description varchar NULL, -- Принцип классификации
	CONSTRAINT ar_system_assignments_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_system_assignments."name" IS 'Наименование';
COMMENT ON COLUMN archrep_test.ar_system_assignments.description IS 'Принцип классификации';


-- archrep_test.ar_system_hosting_types определение

-- Drop table

-- DROP TABLE archrep_test.ar_system_hosting_types;

CREATE TABLE archrep_test.ar_system_hosting_types (
	"name" varchar NOT NULL, -- Наименование
	id bigserial NOT NULL,
	CONSTRAINT ar_system_hosting_types_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_system_hosting_types."name" IS 'Наименование';


-- archrep_test.ar_system_owners определение

-- Drop table

-- DROP TABLE archrep_test.ar_system_owners;

CREATE TABLE archrep_test.ar_system_owners (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование направления
	leader varchar NULL, -- Руководитель направления
	CONSTRAINT ar_system_owners_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_system_owners."name" IS 'Наименование направления';
COMMENT ON COLUMN archrep_test.ar_system_owners.leader IS 'Руководитель направления';


-- archrep_test.ar_system_statuses определение

-- Drop table

-- DROP TABLE archrep_test.ar_system_statuses;

CREATE TABLE archrep_test.ar_system_statuses (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование статуса системы
	description varchar NULL, -- Принцип отнесения системы к данному статусу
	CONSTRAINT ar_system_statuses_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_system_statuses."name" IS 'Наименование статуса системы';
COMMENT ON COLUMN archrep_test.ar_system_statuses.description IS 'Принцип отнесения системы к данному статусу';


-- archrep_test.ar_systems определение

-- Drop table

-- DROP TABLE archrep_test.ar_systems;

CREATE TABLE archrep_test.ar_systems (
	id bigserial NOT NULL,
	code varchar NOT NULL, -- Уникальный код системы (используется в заявках и при именовании серверов)
	"name" varchar NOT NULL, -- Краткое наименование системы
	fullname varchar NULL, -- Полное наименование системы или модуля
	parent_ar_systems_id int8 NULL, -- Ссылка на родительскую систему (для модулей)
	parent_name varchar NULL, -- Наименование родительской системы. Денормализовал для удобства отображения в компоненте "таблица" до момента простановки parent_id
	ar_system_statuses_id int8 NULL, -- Статус системы (FK)
	vendor_ar_partners_id int8 NULL, -- Вендор/разработчик решения(FK)
	supplier_ar_partners_id int8 NULL, -- Поставщик решения, интегратор (FK)
	supporter_ar_partners_id int8 NULL, -- Партнер по поддержке(FK)
	description varchar NULL, -- Описание системы/модуля
	ar_system_owners_id int8 NULL, -- Относится к направлению бизнеса (FK)
	ar_system_hosting_types_id int8 NULL, -- Тип хостинга(FK)
	"comment" varchar NULL, -- Примечание
	technologies varchar(512) NULL,
	technologies_noref varchar NULL, -- временный столбец для формализации технологий
	CONSTRAINT ar_systems_code_key UNIQUE (code),
	CONSTRAINT ar_systems_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_systems.code IS 'Уникальный код системы (используется в заявках и при именовании серверов)';
COMMENT ON COLUMN archrep_test.ar_systems."name" IS 'Краткое наименование системы';
COMMENT ON COLUMN archrep_test.ar_systems.fullname IS 'Полное наименование системы или модуля';
COMMENT ON COLUMN archrep_test.ar_systems.parent_ar_systems_id IS 'Ссылка на родительскую систему (для модулей)';
COMMENT ON COLUMN archrep_test.ar_systems.parent_name IS 'Наименование родительской системы. Денормализовал для удобства отображения в компоненте "таблица" до момента простановки parent_id';
COMMENT ON COLUMN archrep_test.ar_systems.ar_system_statuses_id IS 'Статус системы (FK)';
COMMENT ON COLUMN archrep_test.ar_systems.vendor_ar_partners_id IS 'Вендор/разработчик решения(FK)';
COMMENT ON COLUMN archrep_test.ar_systems.supplier_ar_partners_id IS 'Поставщик решения, интегратор (FK)';
COMMENT ON COLUMN archrep_test.ar_systems.supporter_ar_partners_id IS 'Партнер по поддержке(FK)';
COMMENT ON COLUMN archrep_test.ar_systems.description IS 'Описание системы/модуля';
COMMENT ON COLUMN archrep_test.ar_systems.ar_system_owners_id IS 'Относится к направлению бизнеса (FK)';
COMMENT ON COLUMN archrep_test.ar_systems.ar_system_hosting_types_id IS 'Тип хостинга(FK)';
COMMENT ON COLUMN archrep_test.ar_systems."comment" IS 'Примечание';
COMMENT ON COLUMN archrep_test.ar_systems.technologies_noref IS 'временный столбец для формализации технологий';


-- archrep_test.ar_systems_technologies определение

-- Drop table

-- DROP TABLE archrep_test.ar_systems_technologies;

CREATE TABLE archrep_test.ar_systems_technologies (
	id bigserial NOT NULL,
	systems_id int8 NOT NULL, -- Ссылка на систему
	technologies_id int8 NOT NULL, -- Ссылка на технологию
	CONSTRAINT ar_systems_technologies_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_systems_technologies.systems_id IS 'Ссылка на систему';
COMMENT ON COLUMN archrep_test.ar_systems_technologies.technologies_id IS 'Ссылка на технологию';


-- archrep_test.ar_technologies определение

-- Drop table

-- DROP TABLE archrep_test.ar_technologies;

CREATE TABLE archrep_test.ar_technologies (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Название технологии
	vendor_ar_partners_id int8 NULL, -- Разработчик/вендор
	technology_classes_id int8 NULL, -- Отнесение к классу ПО
	approve_document varchar NULL, -- Основание для включения в каталог технологий
	technology_types_id int8 NULL, -- Тип технологии по классификации техрадара
	technology_statuses_id int8 NULL, -- Статус в техрадаре (ADOPT, HOLD, ACCESS, TRIAL)
	radar_include_flag bool NULL, -- Признак включения в техрадар
	description varchar NULL, -- Краткое описание технологии (в т.ч. ссылка)
	domestic_flag bool NULL, -- Флаг отечественного ПО
	CONSTRAINT ar_technologies_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_technologies."name" IS 'Название технологии';
COMMENT ON COLUMN archrep_test.ar_technologies.vendor_ar_partners_id IS 'Разработчик/вендор';
COMMENT ON COLUMN archrep_test.ar_technologies.technology_classes_id IS 'Отнесение к классу ПО';
COMMENT ON COLUMN archrep_test.ar_technologies.approve_document IS 'Основание для включения в каталог технологий';
COMMENT ON COLUMN archrep_test.ar_technologies.technology_types_id IS 'Тип технологии по классификации техрадара';
COMMENT ON COLUMN archrep_test.ar_technologies.technology_statuses_id IS 'Статус в техрадаре (ADOPT, HOLD, ACCESS, TRIAL)';
COMMENT ON COLUMN archrep_test.ar_technologies.radar_include_flag IS 'Признак включения в техрадар';
COMMENT ON COLUMN archrep_test.ar_technologies.description IS 'Краткое описание технологии (в т.ч. ссылка)';
COMMENT ON COLUMN archrep_test.ar_technologies.domestic_flag IS 'Флаг отечественного ПО';


-- archrep_test.ar_technologies_temp определение

-- Drop table

-- DROP TABLE archrep_test.ar_technologies_temp;

CREATE TABLE archrep_test.ar_technologies_temp (
	"name" varchar(150) NULL,
	vendor_ar_partners_id varchar(150) NULL,
	technology_types_id varchar(150) NULL,
	tehnology_statuses_id varchar(150) NULL,
	radar_include_flag varchar(150) NULL,
	technology_classes_id varchar(164) NULL,
	description varchar(4096) NULL,
	technology_statuses_id varchar(150) NULL,
	approove_document varchar(228) NULL,
	domestic_flag varchar(150) NULL
);


-- archrep_test.ar_technology_classes определение

-- Drop table

-- DROP TABLE archrep_test.ar_technology_classes;

CREATE TABLE archrep_test.ar_technology_classes (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование класса технологии
	description varchar NULL, -- Описание класса технологий, правил отнесения к данному классу
	CONSTRAINT ar_technology_classes_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_technology_classes."name" IS 'Наименование класса технологии';
COMMENT ON COLUMN archrep_test.ar_technology_classes.description IS 'Описание класса технологий, правил отнесения к данному классу';


-- archrep_test.ar_technology_statuses определение

-- Drop table

-- DROP TABLE archrep_test.ar_technology_statuses;

CREATE TABLE archrep_test.ar_technology_statuses (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование статуса (для техрадара)
	fullname varchar NOT NULL, -- Русскоязычное наименование
	description varchar NULL, -- Описание принципов классификации
	CONSTRAINT ar_technology_statuses_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_technology_statuses."name" IS 'Наименование статуса (для техрадара)';
COMMENT ON COLUMN archrep_test.ar_technology_statuses.fullname IS 'Русскоязычное наименование';
COMMENT ON COLUMN archrep_test.ar_technology_statuses.description IS 'Описание принципов классификации';


-- archrep_test.ar_technology_types определение

-- Drop table

-- DROP TABLE archrep_test.ar_technology_types;

CREATE TABLE archrep_test.ar_technology_types (
	id bigserial NOT NULL,
	"name" varchar NOT NULL, -- Наименование типа технологии (для техрадара)
	description varchar NULL, -- Описание правил классификации
	CONSTRAINT ar_technology_types_pkey PRIMARY KEY (id)
);

-- Column comments

COMMENT ON COLUMN archrep_test.ar_technology_types."name" IS 'Наименование типа технологии (для техрадара)';
COMMENT ON COLUMN archrep_test.ar_technology_types.description IS 'Описание правил классификации';