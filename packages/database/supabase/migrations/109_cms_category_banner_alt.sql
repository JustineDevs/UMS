ALTER TABLE public.cms_category_content
  ADD COLUMN IF NOT EXISTS banner_alt text;

COMMENT ON COLUMN public.cms_category_content.banner_alt IS
  'Editorial alternative text for a meaningful category banner; NULL means the image is decorative.';
