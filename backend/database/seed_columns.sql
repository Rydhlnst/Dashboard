-- ============================================================
-- Seed: System Column Definitions
-- Run after migration_v2.sql
-- ============================================================

-- ============================================================
-- Group: all datasets — shared core columns
-- ============================================================
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('all','pdid','PDID','text',1,1,1,0,0,1,'basic'),
('all','po_year','PO Year','text',1,1,1,1,0,2,'basic'),
('all','scarlett_ioms_id_before','Scarlett / IOMS ID Before','text',1,0,0,0,0,3,'basic'),
('all','scarlett_ioms_id_final','Scarlett / IOMS ID Final','text',1,0,0,0,0,4,'basic'),
('all','status_po','Status PO','select',1,1,1,1,0,5,'basic'),
('all','pono_tsel','PoNo Tsel','text',1,1,1,0,0,6,'basic'),
('all','capex','Capex','decimal',1,0,0,0,0,7,'basic'),
('all','band','Band','select',1,1,1,1,0,8,'basic'),
('all','sector','Sector','text',1,0,1,0,0,9,'basic'),
('all','project_category','Project Category','select',1,1,1,1,0,10,'basic'),
('all','sow_actual','SOW Actual','text',1,1,1,1,0,11,'basic'),
('all','vendor_principle','Vendor Principle','select',1,1,1,1,0,12,'basic'),
('all','siteid_po','SiteID PO','text',1,0,0,0,0,13,'site'),
('all','siteid_act','SiteID Act','text',1,1,1,0,0,14,'site'),
('all','neid_act','NEID Act','text',1,0,0,0,0,15,'site'),
('all','site_name','Site Name','text',1,1,1,0,0,16,'site'),
('all','infra_type','Infra Type','select',1,0,1,1,0,17,'site'),
('all','lat','Latitude','decimal',1,0,0,0,0,18,'site'),
('all','lng','Longitude','decimal',1,0,0,0,0,19,'site'),
('all','city','City','text',1,0,1,1,0,20,'site'),
('all','province','Province','text',1,0,1,1,0,21,'site'),
('all','nop','NOP','select',1,1,1,1,0,22,'site'),
('all','tp_detail','TP Detail','text',1,1,1,1,0,23,'site'),
('all','progress_done_flag','Progress Done (FLAG)','text',1,1,1,1,0,24,'progress'),
('all','rfs_actual','RFS Actual','date',1,1,1,0,0,25,'progress'),
('all','rfs_month','RFS Month','text',1,1,1,1,0,26,'progress'),
('all','mitra_impl','Mitra Impl','select',1,1,1,1,0,27,'progress'),
('all','progress_act','Progress Act','text',1,0,0,0,0,28,'progress'),
('all','issue_category','Issue Category','text',1,1,1,1,0,29,'progress'),
('all','notes_progress','Notes Progress','textarea',1,0,0,0,0,30,'progress'),
('all','pic_blocking','PIC Blocking','text',1,1,1,1,0,31,'progress'),
('all','detail_pic_blocking','Detail PIC Blocking','textarea',1,0,0,0,0,32,'progress')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- ============================================================
-- Group: closing dataset — progress + acceptance + financial
-- ============================================================
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('closing','gap_closing','Gap Closing','textarea',1,1,0,0,0,1,'progress'),
('closing','current_position','Current Position','text',1,1,1,1,0,2,'progress'),
('closing','status_project','Status Project','select',1,1,1,1,0,3,'progress'),
('closing','progress_closing','Progress Closing','text',1,1,1,1,0,4,'progress'),
('closing','sub_progress_closing','Sub Progress Closing','text',1,1,1,0,0,5,'progress'),
-- Acceptance ATP
('closing','atp_status','ATP Status','select',1,0,1,1,0,10,'acceptance'),
('closing','atp_blocking','ATP Blocking','textarea',1,0,0,0,0,11,'acceptance'),
('closing','atp_tagging_plan_ori','Tagging Plan Ori','date',1,0,0,0,0,12,'acceptance'),
('closing','atp_tagging_replan','Tagging Re-plan','date',1,0,0,0,0,13,'acceptance'),
('closing','atp_tagging_done','Tagging Done','date',1,0,0,0,0,14,'acceptance'),
('closing','atp_approved','ATP Approved','date',1,0,0,0,0,15,'acceptance'),
-- Acceptance LV
('closing','lv_status','LV Status','select',1,0,1,1,0,20,'acceptance'),
('closing','lv_blocking','LV Blocking','textarea',1,0,0,0,0,21,'acceptance'),
('closing','elv_plan_ori','eLV Plan Ori','date',1,0,0,0,0,22,'acceptance'),
('closing','elv_replan','eLV Re-Plan','date',1,0,0,0,0,23,'acceptance'),
('closing','elv_approved','eLV Approved','date',1,0,0,0,0,24,'acceptance'),
-- Acceptance OAC
('closing','oac_status','OAC Status','select',1,0,1,1,0,30,'acceptance'),
('closing','oac_blocking','OAC Blocking','textarea',1,0,0,0,0,31,'acceptance'),
('closing','oac_plan_ori','OAC Plan Ori','date',1,0,0,0,0,32,'acceptance'),
('closing','oac_replan','OAC Re-Plan','date',1,0,0,0,0,33,'acceptance'),
('closing','oac_approved','OAC Approved','date',1,0,0,0,0,34,'acceptance'),
-- Acceptance QC
('closing','qc_status','QC Status','select',1,0,1,1,0,40,'acceptance'),
('closing','qc_blocking','QC Blocking','textarea',1,0,0,0,0,41,'acceptance'),
('closing','qc_plan_ori','QC Plan Ori','date',1,0,0,0,0,42,'acceptance'),
('closing','qc_replan','QC Re-Plan','date',1,0,0,0,0,43,'acceptance'),
('closing','qc_sign','QC Sign','date',1,0,0,0,0,44,'acceptance'),
-- Acceptance SQAC
('closing','sqac_status','SQAC Status','select',1,0,1,1,0,50,'acceptance'),
('closing','sqac_blocking','SQAC Blocking','textarea',1,0,0,0,0,51,'acceptance'),
('closing','sqac_plan_ori','SQAC Plan Ori','date',1,0,0,0,0,52,'acceptance'),
('closing','sqac_replan','SQAC Re-Plan','date',1,0,0,0,0,53,'acceptance'),
('closing','sqac_approved','SQAC Approved','date',1,0,0,0,0,54,'acceptance'),
-- Acceptance BAUT
('closing','baut_status','BAUT Status','select',1,0,1,1,0,60,'acceptance'),
('closing','baut_blocking','BAUT Blocking','textarea',1,0,0,0,0,61,'acceptance'),
('closing','baut_plan_ori','BAUT Plan Ori','date',1,0,0,0,0,62,'acceptance'),
('closing','baut_replan','BAUT Re-Plan','date',1,0,0,0,0,63,'acceptance'),
('closing','baut_approved','BAUT Approved','date',1,0,0,0,0,64,'acceptance'),
-- Acceptance BAST
('closing','bast_status','BAST Status','select',1,0,1,1,0,70,'acceptance'),
('closing','bast_blocking','BAST Blocking','textarea',1,0,0,0,0,71,'acceptance'),
('closing','bast_plan_ori','BAST Plan Ori','date',1,0,0,0,0,72,'acceptance'),
('closing','bast_replan','BAST Re-Plan','date',1,0,0,0,0,73,'acceptance'),
('closing','bast_approved','BAST Approved','date',1,0,0,0,0,74,'acceptance'),
-- Financial
('closing','price_po','Price PO','decimal',1,1,0,1,0,80,'financial'),
('closing','price_po_to_be_claim','Price PO to be Claim','decimal',1,1,0,1,0,81,'financial'),
('closing','price_bast','Price BAST (Ach)','decimal',1,1,0,1,0,82,'financial'),
('closing','remaining_po','Remaining PO','decimal',1,1,0,1,0,83,'financial'),
('closing','price_po_presales','Price PO Presales','decimal',1,0,0,0,0,84,'financial'),
('closing','wbs_level3','WBS Level3','text',1,0,0,0,0,85,'financial'),
('closing','network_number','Network Number','text',1,0,0,0,0,86,'financial'),
('closing','cid1','CID-1','text',1,0,0,0,0,87,'financial'),
('closing','cid1_price_bast','CID-1 Price BAST','decimal',1,0,0,0,0,88,'financial'),
('closing','cid1_creation_date','CID-1 Creation Date','date',1,0,0,0,0,89,'financial'),
('closing','cid1_approve_date','CID-1 Approve Date','date',1,0,0,0,0,90,'financial'),
('closing','cid2','CID-2','text',1,0,0,0,0,91,'financial'),
('closing','cid2_price_bast','CID-2 Price BAST','decimal',1,0,0,0,0,92,'financial'),
('closing','cid2_creation_date','CID-2 Creation Date','date',1,0,0,0,0,93,'financial'),
('closing','cid2_approve_date','CID-2 Approve Date','date',1,0,0,0,0,94,'financial')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- ============================================================
-- Group: filter900 dataset — specific columns
-- ============================================================
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('filter900','remarks_sow','Remarks SOW','textarea',1,1,0,0,0,1,'filter'),
('filter900','replan_rfs','Re-Plan RFS','date',1,1,0,0,0,2,'filter'),
('filter900','plan_po','Plan PO','decimal',1,1,0,1,0,3,'filter'),
('filter900','released_po','Released PO','decimal',1,1,0,1,0,4,'filter')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);

-- ============================================================
-- Group: refinement dataset — specific columns
-- ============================================================
INSERT INTO `column_definitions`
  (`dataset_type`,`field_key`,`label`,`field_type`,`is_system`,`is_visible`,`is_filterable`,`is_chartable`,`is_required`,`sort_order`,`column_group`)
VALUES
('refinement','plan_po','Plan PO','decimal',1,1,0,1,0,1,'refinement'),
('refinement','released_po','Released PO','decimal',1,1,0,1,0,2,'refinement')
ON DUPLICATE KEY UPDATE
  `label`=VALUES(`label`), `field_type`=VALUES(`field_type`), `is_system`=1,
  `sort_order`=VALUES(`sort_order`), `column_group`=VALUES(`column_group`);
