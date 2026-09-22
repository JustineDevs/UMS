-- Device names are unique within an organization, not globally.
ALTER TABLE public.pos_devices DROP CONSTRAINT IF EXISTS pos_devices_name_key;
ALTER TABLE public.pos_devices
  ADD CONSTRAINT pos_devices_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS pos_devices_organization_name_key
  ON public.pos_devices (organization_id, name);
