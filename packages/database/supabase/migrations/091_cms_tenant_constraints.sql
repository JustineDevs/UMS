DO $$
DECLARE
  fallback_org text;
BEGIN
  SELECT id INTO fallback_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF fallback_org IS NULL THEN
    RAISE EXCEPTION 'CMS tenant constraints require at least one organization';
  END IF;
  UPDATE public.cms_pages SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_category_content SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_blog_posts SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_navigation SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_redirects SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_announcement SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_form_submissions SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_form_settings SET organization_id = fallback_org WHERE organization_id IS NULL;
  UPDATE public.cms_navigation_draft SET organization_id = fallback_org WHERE organization_id IS NULL;
END $$;

ALTER TABLE public.cms_pages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_category_content ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_blog_posts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_navigation ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_redirects ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_announcement ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_form_submissions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_form_settings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.cms_navigation_draft ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.cms_pages ADD CONSTRAINT cms_pages_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_category_content ADD CONSTRAINT cms_category_content_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_blog_posts ADD CONSTRAINT cms_blog_posts_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_navigation ADD CONSTRAINT cms_navigation_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_redirects ADD CONSTRAINT cms_redirects_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_announcement ADD CONSTRAINT cms_announcement_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_form_submissions ADD CONSTRAINT cms_form_submissions_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_form_settings ADD CONSTRAINT cms_form_settings_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.cms_navigation_draft ADD CONSTRAINT cms_navigation_draft_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.cms_page_mutations ADD CONSTRAINT cms_page_mutations_org_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
