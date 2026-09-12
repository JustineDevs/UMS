/* Generated from the vendored ecommerce component source; provenance is retained in each definition. */
export type CapturedEcommerceProperty = Record<string, unknown>;
export type CapturedEcommerceDefinition = { name: string; attributes?: readonly string[]; image?: string; html?: string; properties: readonly CapturedEcommerceProperty[]; fullUpdate?: boolean; userServerTemplate?: boolean };
export const UVS_ECOMMERCE_CAPTURE: Readonly<Record<string, CapturedEcommerceDefinition>> = {
  "productComponent": {
    "fullUpdate": false,
    "userServerTemplate": false,
    "name": "Product",
    "attributes": [
      "data-v-component-product"
    ],
    "image": "icons/product.svg",
    "html": "\n<section class=\"container product\" data-v-component-product data-v-product_id=\"1\">\n\n\n\t<div class=\"row g-0\">\n\t\t<div class=\"col-md-6 col-sm-12\">\n\t\t\n\t\t\t<div id=\"product-gallery\" class=\"carousel slide\" data-bs-ride=\"carousel\" data-bs-touch=\"true\" data-v-product-images>\n\t\t\t  <div class=\"carousel-inner\">\n\t\t\t\t<div class=\"carousel-item active\">\n\t\t\t\t\t<div class=\"zoom\" data-v-product-main-image-background-image>\n\t\t\t\t\t\t<img src=\"img/demo/product.jpg\" loading=\"lazy\" class=\"d-block w-100\" alt=\"\" data-v-product-main-image>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\t\t\t\t\t\n\t\t\t\t<div class=\"carousel-item\" data-v-product-image>\n\t\t\t\t\t<div class=\"zoom\" data-v-product-image-background-image>\n\t\t\t\t\t\t<img src=\"img/demo/product.jpg\" loading=\"lazy\" class=\"d-block w-100\" alt=\"\" data-v-product-image-src>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"carousel-item\" data-v-product-image>\n\t\t\t\t\t<div class=\"zoom\" data-v-product-image-background-image>\n\t\t\t\t\t\t<img src=\"img/demo/product-2.jpg\" loading=\"lazy\" class=\"d-block w-100\" alt=\"\" data-v-product-image-src>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t  </div>\n\t\t\t  <button class=\"carousel-control-prev\" type=\"button\" data-bs-target=\"#product-gallery\" data-bs-slide=\"prev\">\n\t\t\t\t<span class=\"carousel-control-prev-icon\" aria-hidden=\"true\"></span>\n\t\t\t\t<span class=\"visually-hidden\">Previous</span>\n\t\t\t  </button>\n\t\t\t  <button class=\"carousel-control-next\" type=\"button\" data-bs-target=\"#product-gallery\" data-bs-slide=\"next\">\n\t\t\t\t<span class=\"carousel-control-next-icon\" aria-hidden=\"true\"></span>\n\t\t\t\t<span class=\"visually-hidden\">Next</span>\n\t\t\t  </button>\n\t\t  </div>\n\t\t  \n\t\t  <div class=\"carousel\">\n\t\t  \n\t\t\t<div class=\"carousel-thumbs\" data-v-product-images>\n\t\t\t\t<button type=\"button\" data-bs-target=\"#product-gallery\" class=\"img-thumbnail\" data-bs-slide-to=\"0\">\n\t\t\t\t\t<img src=\"\" alt=\"\" class=\"d-block w-100\" loading=\"lazy\" data-v-product-main-image>\n\t\t\t\t</button>\n\t\t\t\t<button type=\"button\" data-bs-target=\"#product-gallery\" class=\"img-thumbnail\" data-bs-slide-to=\"1\" data-v-product-image>\n\t\t\t\t\t<img src=\"\" alt=\"\" class=\"d-block w-100\" loading=\"lazy\" data-v-product-image-src>\n\t\t\t\t</button>\n\t\t\t\t<button type=\"button\" data-bs-target=\"#product-gallery\" class=\"img-thumbnail\" data-bs-slide-to=\"2\" data-v-product-image>\n\t\t\t\t\t<img src=\"\" alt=\"\" class=\"d-block w-100\" loading=\"lazy\" data-v-product-image-src>\n\t\t\t\t</button>\n\t\t\t\t<button type=\"button\" data-bs-target=\"#product-gallery\" class=\"img-thumbnail\" data-bs-slide-to=\"3\" data-v-product-image>\n\t\t\t\t\t<img src=\"\" alt=\"\" class=\"d-block w-100\" loading=\"lazy\" data-v-product-image-src>\n\t\t\t\t</button>\n\t\t\t</div>\n\t\t\t\n\t\t  </div>\n\t\n\t\n\t\t\n\t\t</div>\n\n\t\t<div class=\"col-md-6 col-sm-12 p-4\" id=\"product\">\n\t\t\t<a href=\"#\"><span class=\"text-muted\">mango</span></a>\n\t\t\t\n\t\t\t<h1 class=\"product-name\" data-v-product-name>One Shoulder Glitter Midi Dress</h1>\n\t\t\t\n\t\t\t\n\t\t\t<div class=\"mb-2\">\n\t\t\t\t<small class=\"text-warning\"> \n\t\t\t\t\t<i class=\"la la-star\"></i>\n\t\t\t\t\t<i class=\"la la-star\"></i>\n\t\t\t\t\t<i class=\"la la-star\"></i>\n\t\t\t\t\t<i class=\"la la-star\"></i>\n\t\t\t\t\t<i class=\"la la-star-half\"></i>\n\t\t\t\t</small>\n\t\t\t\t<a href=\"#reviews-tab-pane\" class=\"ms-2\" data-bs-toggle=\"tab\" type=\"button\" data-bs-target=\"#reviews-tab-pane\">(30 reviews)</a>\n\t\t\t</div>\n\n\t\t\t<p class=\"product-price\">\n\t\t\t\t<span class=\"price\" data-v-product-price_tax_formatted>$49.00</span>\n\t\t\t\t<span class=\"text-decoration-line-through text-secondary text-opacity-75\">$350</span>\n\t\t\t\t<small class=\"fs-6 ms-2 text-danger\">26% Off</small>\n\t\t\t</p>\n\t\t\t\n\t\t\t<!--\n\t\t\t<p class=\"product-price fs-3\">\n\t\t\t\t<span class=\"old-price text-muted text-small align-middle text-decoration-line-through\" data-v-product-price-discount>$65.00</span>\n\t\t\t\t<span class=\"old-currency text-muted text-small align-middle text-decoration-line-through\">$</span>\n\t\t\t\t<span class=\"price fw-bold\" data-v-product-price_tax>$49.00</span>\n\t\t\t\t<span class=\"currency\">$</span>\n\t\t\t</p>\n\t\t\t-->\n\n\t\t\t<!-- Form -->\n\t\t\t<form class=\"cart-form clearfix\" method=\"post\" action=\"/cart\">\n\t\t\t\n\t\t\t\t<div class=\"cart-fav-box \">\n\t\t\t\t\t<!-- Cart -->\n\t\t\t\t\t<!-- button type=\"submit\" name=\"addtocart\" value=\"5\" class=\"btn btn-primary\" data-v-product-id data-v-vvveb-action=\"addToCart\">Add to cart</button -->\n\t\t\t\t\t\n\t\t\t\t\t\t<input type=\"hidden\" name=\"product_id\" data-v-product-product_id>\n\t\t\t\t\t\t\n\n\n\t\t\t\t\t\t<div>\n\t\t\t\t\t\n\t\t\t\t\t\t\t<hr class=\"border opacity-50\">\n\n\t\t\t\t\t\t\t<div class=\"form-group mt-5\">\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t<div class=\"quantity\">\n\t\t\t\t\t\t\t\t\t<div class=\"input-group spinner\">\n\t\t\t\t\t\t\t\t\t\t<button class=\"btn btn-minus\"><i class=\"la la-minus\"></i></button>\n\t\t\t\t\t\t\t\t\t\t<input type=\"number\" name=\"quantity\" value=\"1\" size=\"1\" id=\"input-quantity\" class=\"form-control\">\n\t\t\t\t\t\t\t\t\t\t<button class=\"btn btn-plus\"><i class=\"la la-plus\"></i></button>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t\t\t<button type=\"button\" formaction=\"/cart/1\" id=\"button-cart\" class=\"btn btn-primary btn-shadow px-4 mx-2 button-cart\" data-v-vvveb-action=\"addToCart\">\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t<span class=\"loading d-none\">\n\t\t\t\t\t\t\t\t\t\t<span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\" aria-hidden=\"true\">\n\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t<span>Add to cart</span>...\n\t\t\t\t\t\t\t\t\t</span>\n\n\t\t\t\t\t\t\t\t\t<span class=\"button-text\" >\n\t\t\t\t\t\t\t\t\t\t<i class=\"la la-shopping-bag la-lg me-2\"></i> <span>Add to cart</span>\n\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t</button> \n\n\t\t\t\t\t\t\t\t<button type=\"button\" formaction=\"/checkout/1\" id=\"buynow\" class=\"btn btn-light btn-shadow border px-4 buynow\" data-v-vvveb-action=\"addToCart\">\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t<span class=\"loading d-none\">\n\t\t\t\t\t\t\t\t\t\t<span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\" aria-hidden=\"true\">\n\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t<span >Add to cart</span>...\n\t\t\t\t\t\t\t\t\t</span>\n\n\t\t\t\t\t\t\t\t\t<span class=\"button-text\" >\n\t\t\t\t\t\t\t\t\t\t<span>Buy now</span> <i class=\"la la-arrow-right la-lg ms-2\"></i> \n\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t</button>\n\n\t\t\t\t\t\t\t\t<input type=\"hidden\" name=\"product_id\" value=\"34\">&nbsp;\n\n\t\t\t\t\t\t\t\t<div class=\"product_wish_compare mt-3\">\n\t\t\t\t\t\t\t\t\t<button type=\"button\" class=\"btn btn-sm btn-outline-secondary border-0\" title=\"Add to Wish List\"><i class=\"la la-heart\"></i> Add to Wish List</button>\n\t\t\t\t\t\t\t\t\t<button type=\"button\" class=\"btn btn-sm btn-outline-secondary border-0\" title=\"Compare this Product\"><i class=\"la la-random\"></i> Compare this Product</button>\n\t\t\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t<!-- \n\t\t\t\t\t\t<div class=\"row g-2\">\n\t\t\t\t\t\t\t<div class=\"col-auto\">\n\n\t\t\t\t\t\t\t\t<input name=\"quantity[3]\" value=\"1\" size=\"5\" class=\"form-control\" type=\"number\">  \n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t\t<div class=\"col-auto\">\n\t\t\t\t\t\t\t\t<a href=\"#\" class=\"btn btn-primary px-5\" data-v-vvveb-action=\"addToCart\">\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t<span class=\"loading d-none\">\n\t\t\t\t\t\t\t\t\t\t<span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\" aria-hidden=\"true\">\n\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t<span >Add to cart</span>...\n\t\t\t\t\t\t\t\t\t</span>\n\n\t\t\t\t\t\t\t\t\t<span class=\"button-text\" >\n\t\t\t\t\t\t\t\t\t\t<i class=\"la la-shopping-bag la-lg me-2\"></i> Add to cart\n\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t</a>   \t\n\t\t\t\t\t\t\t</div>\n\n\t\t\t\t\t\t\t<div class=\"col-auto\">\n\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t<a href=\"#\" class=\"btn btn-light border\" data-v-vvveb-action=\"addToCart\">\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t<span class=\"loading d-none\">\n\t\t\t\t\t\t\t\t\t\t<span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\" aria-hidden=\"true\">\n\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t<span >Add to favorites</span>...\n\t\t\t\t\t\t\t\t\t</span>\n\n\t\t\t\t\t\t\t\t\t<span class=\"button-text\" >\n\t\t\t\t\t\t\t\t\t\t<i class=\"la la-heart la-lg\"></i>\n\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t</a>  \t\t\t\t\t\n\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t<div class=\"col-auto\">\n\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t<a href=\"#\" class=\"btn btn-light border\" data-v-vvveb-action=\"addToCart\">\n\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\t<span class=\"loading d-none\">\n\t\t\t\t\t\t\t\t\t\t\t<span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\" aria-hidden=\"true\">\n\t\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\t\t<span >Add to compare</span>...\n\t\t\t\t\t\t\t\t\t\t</span>\n\n\t\t\t\t\t\t\t\t\t\t<span class=\"button-text\" >\n\t\t\t\t\t\t\t\t\t\t\t<i class=\"la la-random la-lg\"></i>\n\t\t\t\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t\t\t</a>  \n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t\t-->\n\t\t\t\t\t\n\t\t\t\t</div>\n\t\t\t</form>\n\t\t\t\n\t\t</div>\n\n\t\t\t<ul class=\"nav nav-tabs mt-5\" id=\"productTabs\" role=\"tablist\">\n\t\t\t  <li class=\"nav-item\" role=\"presentation\">\n\t\t\t\t<button class=\"nav-link active\" id=\"description-tab\" data-bs-toggle=\"tab\" data-bs-target=\"#description-tab-pane\" type=\"button\" role=\"tab\" aria-controls=\"description-tab-pane\" aria-selected=\"true\">\n\t\t\t\t\tDescription\n\t\t\t\t</button>\n\t\t\t  </li>\n\t\t\t  <li class=\"nav-item\" role=\"presentation\">\n\t\t\t\t<button class=\"nav-link\" id=\"reviews-tab\" data-bs-toggle=\"tab\" data-bs-target=\"#reviews-tab-pane\" type=\"button\" role=\"tab\" aria-controls=\"reviews-tab-pane\" aria-selected=\"false\">\n\t\t\t\t\tReviews\n\t\t\t\t</button>\n\t\t\t  </li>\n\t\t\t  <li class=\"nav-item\" role=\"presentation\">\n\t\t\t\t<button class=\"nav-link\" id=\"details-tab\" data-bs-toggle=\"tab\" data-bs-target=\"#details-tab-pane\" type=\"button\" role=\"tab\" aria-controls=\"details-tab-pane\" aria-selected=\"false\">\n\t\t\t\t\tDetails\n\t\t\t\t</button>\n\t\t\t  </li>\t\t\t  \n\t\t\t  <li class=\"nav-item\" role=\"presentation\">\n\t\t\t\t<button class=\"nav-link\" id=\"questions-tab\" data-bs-toggle=\"tab\" data-bs-target=\"#questions-tab-pane\" type=\"button\" role=\"tab\" aria-controls=\"questions-tab-pane\" aria-selected=\"false\">\n\t\t\t\t\tQuestions &amp; Answers\n\t\t\t\t</button>\n\t\t\t  </li>\n\t\t\t</ul>\n\t\t\t\n\t\t\t<div class=\"tab-content\" id=\"productTabsContent\">\n\t\t\t  <div class=\"tab-pane show active\" id=\"description-tab-pane\" role=\"tabpanel\" aria-labelledby=\"description-tab\" tabindex=\"0\">\n\t\t\t  \n\t\t\t\t<div class=\"description\" data-v-product-content>\n\t\t\t\t\n\t\t\t\t\tMauris viverra cursus ante laoreet eleifend. Donec vel fringilla ante. Aenean finibus velit id urna vehicula, nec maximus est sollicitudin. Praesent at tempus lectus, eleifend blandit felis. Fusce augue arcu, consequat a nisl aliquet, consectetur elementum turpis. Donec iaculis lobortis nisl, et viverra risus imperdiet eu. Etiam mollis posuere elit non sagittis. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc quis arcu a magna sodales venenatis. Integer non diam sit amet magna luctus mollis ac eu nisi. In accumsan tellus ut dapibus blandit.\n\t\t\t\t\t\n\t\t\t\t</div>\n\t\t\t  \n\t\t\t  </div>\n\t\t\t  <div class=\"tab-pane\" id=\"reviews-tab-pane\" role=\"tabpanel\" aria-labelledby=\"reviews-tab\" tabindex=\"0\">\n\t\t\t\t  \n\t\t\t  </div>\n\t\t\t  <div class=\"tab-pane\" id=\"details-tab-pane\" role=\"tabpanel\" aria-labelledby=\"details-tab\" tabindex=\"0\">\n\t\t\t  </div>\n\t\t\t  <div class=\"tab-pane\" id=\"questions-tab-pane\" role=\"tabpanel\" aria-labelledby=\"questions-tab\" tabindex=\"0\">\n\t\t\t\t  \n\t\t\t  </div>\n\t\t\t</div>\n\t\t\t\n\t\t\t\n\t</div>\n</section>\n",
    "properties": [
      {
        "name": "Product name <span class='text-muted'>(autocomplete)</span>",
        "key": "post",
        "group": "autocomplete",
        "htmlAttr": "data-v-product_id",
        "inline": false,
        "col": 12,
        "inputtype": "AutocompleteInput",
        "data": {
          "url": "/?module=editor/autocomplete&action=products&type="
        }
      },
      {
        "name": "Image size",
        "key": "image_size",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-image_size",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "",
              "text": "Default"
            },
            {
              "value": "thumb",
              "text": "Thumb"
            },
            {
              "value": "medium",
              "text": "Medium"
            },
            {
              "value": "large",
              "text": "Large"
            },
            {
              "value": "xlarge",
              "text": "Extra large"
            }
          ]
        }
      }
    ]
  },
  "productsComponent": {
    "fullUpdate": false,
    "userServerTemplate": false,
    "name": "Products",
    "attributes": [
      "data-v-component-products"
    ],
    "image": "icons/products.svg",
    "html": "\n<div class=\"container\" data-v-component-products=\"popular\" data-v-limit=\"3\">\n    <div class=\"row\">\n        <div class=\"col-sm-12 col-md-6 col-lg mb-2\" data-v-product=\"\" data-v-id=\"19\">\n            <article class=\"single-product-wrapper\">\n\n                <a href=\"/product/product-nineteen\" data-v-product-url=\"\" title=\"Product 19\"> </a>\n                <div class=\"product-image\">\n                    <a href=\"/product/product-nineteen\" data-v-product-url=\"\" title=\"Product 19\">\n\n                        <img src=\"../../media/demo/products/1-1.webp\" data-v-product-alt=\"\" alt=\"Product 19\"\n                            data-v-product-image=\"thumb\">\n\n\n                        <img class=\"hover-img\" src=\"../../media/demo/products/1-2.webp\"\n                            data-v-product-alt=\"\" alt=\"Product 19\" data-v-product-image-1=\"thumb\" data-v-id=\"52\"\n                            data-v-type=\"product_image\">\n                    </a>\n\n\n                    <div class=\"product-favourite\">\n                        <a href=\"/product/product-nineteen\" data-v-product-url=\"\" data-v-product-title=\"\"\n                            class=\"la la-heart\" title=\"Product 19\"></a>\n                    </div>\n                </div>\n\n\n                <div class=\"product-content\">\n\n                    <a href=\"/product/product-nineteen\" data-v-product-url=\"\" title=\"Product 19\">\n                        <h6 data-v-product-name=\"\">Product 19</h6>\n                    </a>\n\n                    <p class=\"product-price\" data-v-product-price_tax_formatted=\"\">$256.99</p>\n\n\n                    <div class=\"hover-content\">\n\n                        <div class=\"add-to-cart-btn\">\n                            <input type=\"hidden\" name=\"product_id\" value=\"19\" data-v-product-product_id=\"\">\n                            <a href=\"/product/product-nineteen\" class=\"btn btn-primary w-100\"\n                                data-v-product-url=\"cart/cart/index\" data-v-vvveb-action=\"addToCart\"\n                                data-product_id=\"19\" title=\"Product 19\">\n                                <span class=\"loading d-none\">\n                                    <span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\"\n                                        aria-hidden=\"true\"> </span>\n                                    <span>Add to cart</span>...\n                                </span>\n\n                                <span class=\"button-text\">\n                                    Add to cart\n                                </span>\n                            </a>\n                        </div>\n                    </div>\n                </div>\n            </article>\n        </div>\n        <div class=\"col-sm-12 col-md-6 col-lg mb-2\" data-v-product=\"\" data-v-id=\"18\">\n            <article class=\"single-product-wrapper\">\n\n                <a href=\"/product/product-eighteen\" data-v-product-url=\"\" title=\"Product 18\"> </a>\n                <div class=\"product-image\">\n                    <a href=\"/product/product-eighteen\" data-v-product-url=\"\" title=\"Product 18\">\n\n                        <img src=\"../../media/demo/products/1-1.webp\" data-v-product-alt=\"\" alt=\"Product 18\"\n                            data-v-product-image=\"thumb\">\n\n\n                        <img class=\"hover-img\" src=\"../../media/demo/products/1-2.webp\"\n                            data-v-product-alt=\"\" alt=\"Product 18\" data-v-product-image-1=\"thumb\" data-v-id=\"49\"\n                            data-v-type=\"product_image\">\n                    </a>\n\n\n                    <div class=\"product-favourite\">\n                        <a href=\"/product/product-eighteen\" data-v-product-url=\"\" data-v-product-title=\"\"\n                            class=\"la la-heart\" title=\"Product 18\"></a>\n                    </div>\n                </div>\n\n\n                <div class=\"product-content\">\n\n                    <a href=\"/product/product-eighteen\" data-v-product-url=\"\" title=\"Product 18\">\n                        <h6 data-v-product-name=\"\">Product 18</h6>\n                    </a>\n\n                    <p class=\"product-price\" data-v-product-price_tax_formatted=\"\">$129.00</p>\n\n\n                    <div class=\"hover-content\">\n\n                        <div class=\"add-to-cart-btn\">\n                            <input type=\"hidden\" name=\"product_id\" value=\"18\" data-v-product-product_id=\"\">\n                            <a href=\"/product/product-eighteen\" class=\"btn btn-primary w-100\"\n                                data-v-product-url=\"cart/cart/index\" data-v-vvveb-action=\"addToCart\"\n                                data-product_id=\"18\" title=\"Product 18\">\n                                <span class=\"loading d-none\">\n                                    <span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\"\n                                        aria-hidden=\"true\"> </span>\n                                    <span>Add to cart</span>...\n                                </span>\n\n                                <span class=\"button-text\">\n                                    Add to cart\n                                </span>\n                            </a>\n                        </div>\n                    </div>\n                </div>\n            </article>\n        </div>\n        <div class=\"col-sm-12 col-md-6 col-lg mb-2\" data-v-product=\"\" data-v-id=\"17\">\n            <article class=\"single-product-wrapper\">\n\n                <a href=\"/product/product-seventeen\" data-v-product-url=\"\" title=\"Product 17\"> </a>\n                <div class=\"product-image\">\n                    <a href=\"/product/product-seventeen\" data-v-product-url=\"\" title=\"Product 17\">\n\n                        <img src=\"../../media/demo/products/1-1.webp\" data-v-product-alt=\"\" alt=\"Product 17\"\n                            data-v-product-image=\"thumb\">\n\n\n                        <img class=\"hover-img\" src=\"../../media/demo/products/1-1.webp\"\n                            data-v-product-alt=\"\" alt=\"Product 17\" data-v-product-image-1=\"thumb\" data-v-id=\"47\"\n                            data-v-type=\"product_image\">\n                    </a>\n\n\n                    <div class=\"product-favourite\">\n                        <a href=\"/product/product-seventeen\" data-v-product-url=\"\" data-v-product-title=\"\"\n                            class=\"la la-heart\" title=\"Product 17\"></a>\n                    </div>\n                </div>\n\n\n                <div class=\"product-content\">\n\n                    <a href=\"/product/product-seventeen\" data-v-product-url=\"\" title=\"Product 17\">\n                        <h6 data-v-product-name=\"\">Product 17</h6>\n                    </a>\n\n                    <p class=\"product-price\" data-v-product-price_tax_formatted=\"\">$129.00</p>\n\n\n                    <div class=\"hover-content\">\n\n                        <div class=\"add-to-cart-btn\">\n                            <input type=\"hidden\" name=\"product_id\" value=\"17\" data-v-product-product_id=\"\">\n                            <a href=\"/product/product-seventeen\" class=\"btn btn-primary w-100\"\n                                data-v-product-url=\"cart/cart/index\" data-v-vvveb-action=\"addToCart\"\n                                data-product_id=\"17\" title=\"Product 17\">\n                                <span class=\"loading d-none\">\n                                    <span class=\"spinner-border spinner-border-sm align-middle\" role=\"status\"\n                                        aria-hidden=\"true\"> </span>\n                                    <span>Add to cart</span>...\n                                </span>\n\n                                <span class=\"button-text\">\n                                    Add to cart\n                                </span>\n                            </a>\n                        </div>\n                    </div>\n                </div>\n            </article>\n        </div>\n    </div>\n</div>\t\t\t\n",
    "properties": [
      {
        "name": false,
        "key": "source",
        "inputtype": "RadioButtonInput",
        "inline": false,
        "col": 12,
        "htmlAttr": "data-v-source",
        "data": {
          "inline": true,
          "extraclass": "btn-group-fullwidth btn-group-sm",
          "options": [
            {
              "value": "automatic",
              "icon": "la la-cog",
              "text": "Configuration",
              "title": "Configuration",
              "checked": true
            },
            {
              "value": "autocomplete",
              "text": "Autocomplete",
              "title": "Autocomplete",
              "icon": "la la-search"
            }
          ]
        },
        "setGroup": "[function]",
        "onChange": "[function]",
        "init": "[function]"
      },
      {
        "name": "Products",
        "key": "products",
        "group": "autocomplete",
        "htmlAttr": "data-v-product_id",
        "inline": false,
        "col": 12,
        "inputtype": "[function]",
        "data": {
          "url": "/?module=editor/autocomplete&action=products"
        }
      },
      {
        "name": "Nr. of products",
        "group": "automatic",
        "col": 6,
        "inline": false,
        "key": "limit",
        "htmlAttr": "data-v-limit",
        "inputtype": "NumberInput",
        "data": {
          "value": "4",
          "min": "1",
          "max": "1024",
          "step": "1"
        }
      },
      {
        "name": "Start from page",
        "group": "automatic",
        "col": 6,
        "inline": false,
        "key": "page",
        "htmlAttr": "data-v-page",
        "data": {
          "value": "1",
          "min": "1",
          "max": "1024",
          "step": "1"
        },
        "inputtype": "NumberInput"
      },
      {
        "name": "Order by",
        "group": "automatic",
        "key": "order",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-order_by",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "NULL",
              "text": "Default"
            },
            {
              "value": "price",
              "text": "Price"
            },
            {
              "value": "created_at",
              "text": "Date added"
            },
            {
              "value": "updated_at",
              "text": "Date modified"
            }
          ]
        }
      },
      {
        "name": "Image size",
        "key": "image_size",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-image_size",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "",
              "text": "Default"
            },
            {
              "value": "thumb",
              "text": "Thumb"
            },
            {
              "value": "medium",
              "text": "Medium"
            },
            {
              "value": "large",
              "text": "Large"
            },
            {
              "value": "xlarge",
              "text": "Extra large"
            }
          ]
        }
      },
      {
        "name": "Product type",
        "group": "automatic",
        "key": "order",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-type",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "",
              "text": "Product"
            }
          ]
        }
      },
      {
        "name": "Order direction",
        "group": "automatic",
        "key": "order",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-direction",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "asc",
              "text": "Ascending"
            },
            {
              "value": "desc",
              "text": "Descending"
            }
          ]
        }
      },
      {
        "name": "Limit to categories",
        "group": "automatic",
        "key": "category",
        "htmlAttr": "data-v-category",
        "inline": false,
        "col": 12,
        "inputtype": "TagsInput",
        "data": {
          "url": "/?module=editor/autocomplete&action=categories"
        }
      },
      {
        "name": "Limit to manufacturers",
        "group": "automatic",
        "key": "manufacturer",
        "htmlAttr": "data-v-manufacturer",
        "inline": false,
        "col": 12,
        "inputtype": "TagsInput",
        "data": {
          "url": "/?module=editor/autocomplete&action=manufacturers"
        }
      }
    ]
  },
  "productGalleryComponent": {
    "name": "Products",
    "attributes": [
      "data-v-component-product-gallery"
    ],
    "image": "icons/products.svg",
    "html": "\n",
    "properties": []
  },
  "productCategoriesComponent": {
    "fullUpdate": false,
    "userServerTemplate": false,
    "name": "Product Categories",
    "attributes": [
      "data-v-component-product-categories"
    ],
    "image": "icons/categories.svg",
    "html": "\n<div data-v-component-product-categories>\n<ul class=\"list-unstyled\" data-v-cats>                  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/computers\" data-v-cat-url>\n\t\t  <span data-v-cat-name>Computers</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/electronics\" data-v-cat-url>\n\t\t  <span data-v-cat-name>Electronics</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/tablets\" data-v-cat-url>\n\t\t  <span data-v-cat-name>Tablets</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/toys\" data-v-cat-url>\n\t\t  <span data-v-cat-name>Toys</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/home-kitchen\" data-v-cat-url>\n\t\t  <span data-v-cat-name>Home and Kitchen</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/books\" data-v-cat-url>\n\t\t  <span data-v-cat-name>Books</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/category-1\" data-v-cat-url>\n\t\t  <span data-v-cat-name>category 1</span>\n\t\t</a>\n\t  </li>                                    \n\t  \n\t<li data-v-cat>\n\t\t<a href=\"/shop/category-2\" data-v-cat-url>\n\t\t  <span data-v-cat-name>category 2</span>\n\t\t</a>\n\t  </li>                                    \n</ul>\n</div>\n",
    "properties": [
      {
        "name": "Start from page",
        "group": "automatic",
        "col": 6,
        "inline": false,
        "key": "page",
        "htmlAttr": "data-v-page",
        "data": {
          "value": "1",
          "min": "1",
          "max": "1024",
          "step": "1"
        },
        "inputtype": "NumberInput"
      },
      {
        "name": "Nr. of categories",
        "group": "automatic",
        "col": 6,
        "inline": false,
        "key": "limit",
        "htmlAttr": "data-v-limit",
        "inputtype": "NumberInput",
        "data": {
          "value": "4",
          "min": "1",
          "max": "1024",
          "step": "1"
        }
      },
      {
        "name": "Order by",
        "group": "automatic",
        "key": "order",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-order_by",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "NULL",
              "text": "Default"
            },
            {
              "value": "created_at",
              "text": "Date added"
            },
            {
              "value": "updated_at",
              "text": "Date modified"
            }
          ]
        }
      },
      {
        "name": "Order direction",
        "group": "automatic",
        "key": "order",
        "col": 6,
        "inline": false,
        "htmlAttr": "data-v-direction",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "asc",
              "text": "Ascending"
            },
            {
              "value": "desc",
              "text": "Descending"
            }
          ]
        }
      }
    ]
  },
  "manufacturersComponent": {
    "name": "Manufacturers",
    "attributes": [
      "data-v-component-product-manufacturers"
    ],
    "image": "icons/factory.svg",
    "html": "<ul class=\"list-unstyled\" data-v-component-product-manufacturers=\"sidebar\">\n<li data-v-manufacturer>\n\t  <a href=\"/manufacturer/mango\" data-v-manufacturer-url><span data-v-manufacturer-name>Mango</span></a>\n</li>\n<li data-v-manufacturer>\n\t  <a href=\"/manufacturer/mango\" data-v-manufacturer-url><span data-v-manufacturer-name>Assos</span></a>\n</li>\n<li data-v-manufacturer>\n\t  <a href=\"/manufacturer/mango\" data-v-manufacturer-url><span data-v-manufacturer-name>Brand name</span></a>\n</li>\n</ul>",
    "properties": []
  },
  "cartComponent": {
    "name": "Cart",
    "attributes": [
      "data-v-component-cart"
    ],
    "image": "icons/cart.svg",
    "html": "\n<div class=\"mini-cart\" data-v-component-cart>\n\t\n\t<a class=\"cart-info nav-link \" href role=\"button\" id=\"cart-dropdown\" data-bs-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\" data-v-url=\"cart/cart/index\">\n\t\t<i class=\"la la-lg la-shopping-bag\"></i>\n\t\t<strong class=\"text-top text-bold\" data-v-total_items data-v-if=\"cart.total_items > 0\"></strong>\n\t</a>\n\t\t\t\t\t\n\t\t\t\t\t\n\t<div class=\"cart-box\" aria-labelledby=\"cart-dropdown\">\t\t\t\t\t\n\n\t<div>\n        <div class=\"table-responsive\">\n\t\t\t<table class=\"table cart-table align-middle mb-0\">\n\t\t\t\t<tbody>\n\t\t\t\t\t\n\t\t\t\t\t\n\t\t\t\t\t<tr data-v-cart-product>\n\t\t\t\t\t\t<td class=\"text-center\">\n\t\t\t\t\t\t\t<a href=\"#40\" data-v-cart-product-url>\n\t\t\t\t\t\t\t\t<img src=\"img/demo/product.jpg\" alt=\"iPhone\" class=\"img-rounded\" data-v-cart-product-image width=50>\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</td>\n\t\t\t\t\t\t<td class=\"text-start\">\n\t\t\t\t\t\t\t<a href=\"#40\" class=\"d-block\" data-v-cart-product-url data-v-cart-product-name>\n\t\t\t\t\t\t\t\tiPhone 5\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t<span data-v-cart-product-quantity>1</span> \n\t\t\t\t\t\t\t<i class=\"la la-times text-muted\"></i>\n\t\t\t\t\t\t\t<span data-v-cart-product-price_tax_formatted>$123.20</span>\n\t\t\t\t\t\t</td>\n\t\t\t\t\t\t<td class=\"text-end\">\n\t\t\t\t\t\t\t<a type=\"button\" class=\"btn btn-outline-secondary btn-sm border-0\" data-v-vvveb-action=\"removeFromCart\" data-v-cart-product-remove-url>\n\t\t\t\t\t\t\t\t<i class=\"la la-times\"></i>\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</td>\n\t\t\t\t\t</tr>\n\t\t\t\t\t<tr data-v-cart-product>\n\t\t\t\t\t\t<td class=\"text-center\">\n\t\t\t\t\t\t\t<a href=\"#40\" data-v-cart-product-url>\n\t\t\t\t\t\t\t\t<img src=\"img/demo/product.jpg\" alt=\"iPhone\" class=\"img-rounded\" data-v-cart-product-image width=50>\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</td>\n\t\t\t\t\t\t<td class=\"text-start\">\n\t\t\t\t\t\t\t<a href=\"#40\" class=\"d-block\" data-v-cart-product-url data-v-cart-product-name>\n\t\t\t\t\t\t\t\tiPhone 5\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t\t\n\t\t\t\t\t\t\t<span data-v-cart-product-quantity>1</span> \n\t\t\t\t\t\t\t<i class=\"la la-times text-muted\"></i>\n\t\t\t\t\t\t\t<span data-v-cart-product-price_tax_formatted>$123.20</span>\n\t\t\t\t\t\t</td>\n\t\t\t\t\t\t<td class=\"text-end\">\n\t\t\t\t\t\t\t<a type=\"button\" class=\"btn btn-outline-secondary btn-sm border-0\" data-v-vvveb-action=\"removeFromCart\" data-v-cart-product-remove-url>\n\t\t\t\t\t\t\t\t<i class=\"la la-times\"></i>\n\t\t\t\t\t\t\t</a>\n\t\t\t\t\t\t</td>\n\t\t\t\t\t</tr>\n\t\t\t\t\t<tr data-v-if-not=\"cart.total_items\">\n\t\t\t\t\t\t\t<td colspan=\"100\">\n\t\t\t\t\t\t\t\t<div class=\"d-flex  p-2\">\n\t\t\t\t\t\t\t\t\t<div class=\"text-center p-2 opacity-75\">\n\t\t\t\t\t\t\t\t\t\t<!-- <img src=\"img/bag.svg\" width=\"20\" alt> -->\n\t\t\t\t\t\t\t\t\t\t<i class=\"la la-2x la-shopping-bag\"></i>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t<div class=\"p-2\">\n\t\t\t\t\t\t\t\t\t\t<strong>Empty cart</strong><br>\n\t\t\t\t\t\t\t\t\t\t<span class=\"text-muted\">No products added yet!</span>\n\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</td>\n\t\t\t\t\t</tr>\n\t\t\t\t </tbody>\n\n\t\t  </table>\n\t\t  </div>\n\t\t  \n\t\t  <div class=\"p-3 pt-0 border-top\" data-v-if=\"cart.total_items\">\n\t\t\t\t<div class=\"table-responsive mb-2\" data-v-cart-totals>\n\t\t\t\t\t<table class=\"table mb-0 cart-table cart-total\" cellspacing=\"0\">\n\t\t\t\t\t\t  <tfoot>\n\t\t\t\t\t\t\t  <tr data-v-cart-total>\n\t\t\t\t\t\t\t\t <td colspan=\"5\" class=\"text-end\"><small data-v-cart-total-title>Sub-Total</small>:</td>\n\t\t\t\t\t\t\t\t <td class=\"text-end\">\n\t\t\t\t\t\t\t\t\t<span data-v-cart-total-text data-v-if=\"total.text\"> - </span>\n\t\t\t\t\t\t\t\t\t<span data-v-cart-total-value_formatted data-v-if=\"total.value > 0\">$101.00</span>\n\t\t\t\t\t\t\t\t </td>\n\t\t\t\t\t\t\t  </tr>\n\t\t\t\t\t\t\t  <tr data-v-cart-total>\n\t\t\t\t\t\t\t\t <td colspan=\"5\" class=\"text-end\"><small>Eco Tax (2.00):</small></td>\n\t\t\t\t\t\t\t\t <td class=\"text-end\">$2.00</td>\n\t\t\t\t\t\t\t  </tr>\n\t\t\t\t\t\t\t  <tr data-v-cart-total>\n\t\t\t\t\t\t\t\t <td colspan=\"5\" class=\"text-end\"><small>VAT (19%):</small></td>\n\t\t\t\t\t\t\t\t <td class=\"text-end\">$20.20</td>\n\t\t\t\t\t\t\t  </tr>\n\t\t\t\t\t\t\t  <tr data-v-cart-total>\n\t\t\t\t\t\t\t\t <td colspan=\"5\" class=\"text-end\"><small>Total:</small></td>\n\t\t\t\t\t\t\t\t <td class=\"text-end\">$123.20</td>\n\t\t\t\t\t\t\t  </tr> \n\t\t\t\t\t\t\t  <tr>\n\t\t\t\t\t\t\t\t <td colspan=\"5\" class=\"text-end\">Total:</td>\n\t\t\t\t\t\t\t\t <td class=\"text-end\" data-v-grand-total_formatted>$0</td>\n\t\t\t\t\t\t\t  </tr>\n\t\t\t\t\t\t   </tfoot>\n\n\t\t\t\t\t\t</table>\n\t\t\t\t</div>\n\n\t\t</div>\n\n\t  <div class=\"row mt-2 g-2 px-3 pb-2\" data-v-if=\"cart.total_items\">\n\t\t<div class=\"col-6\">\n\t\t\t<a href=\"\" class=\"btn btn-light btn-sm border w-100\" data-v-url=\"cart/cart/index\">\n\t\t\t\t<i class=\"la la-shopping-cart la-lg\"></i><span>View cart</span>\n\t\t\t</a>\n\t\t  </div>\n\t\t  <div class=\"col-6\">\n\t\t\t<a href=\"\" class=\"btn btn-primary btn-sm w-100\" data-v-url=\"checkout/checkout/index\">\n\t\t\t\t<span>Checkout</span><i class=\"la la-arrow-right la-lg\"></i>\n\t\t\t</a>\n\t\t  </div>\n\t  </div>\n\n\n\t</div>\n\t</div>\n\t\t\n</div>\n",
    "properties": []
  },
  "checkoutComponent": {
    "name": "Checkout",
    "attributes": [
      "data-v-component-checkout"
    ],
    "image": "icons/checkout.svg",
    "html": "\n<form action=\"/checkout\" method=\"post\" enctype=\"multipart/form-data\">\n  <div class=\"container\">\n\t<div class=\"row\">\n\n\t  <div class=\"col-12 col-md-7\">\n\t\t<div class=\"card\" style=\"--bs-card-spacer-y: 1.5rem; --bs-card-spacer-x: 1.5rem; \">\n\t\t  <div class=\"card-body\">\n\t\t\t<div class=\"row \" data-v-if-not=\"this.global.user_id\">\n\n\t\t\t  <div class=\"mb-3 col-6\">\n\t\t\t\t<label class=\"col-form-label\" for=\"first_name\">First Name <span class=\"text-danger text-small\">*</span>\n\t\t\t\t</label>\n\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"first_name\" name=\"first_name\" value=\"\" minlength=\"3\" required=\"\">\n\t\t\t  </div>\n\t\t\t  <div class=\"mb-3 col-6\">\n\t\t\t\t<label class=\"col-form-label\" for=\"last_name\">Last Name <span class=\"text-danger text-small\">*</span>\n\t\t\t\t</label>\n\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"last_name\" name=\"last_name\" value=\"\" minlength=\"3\" required=\"\">\n\t\t\t  </div>\n\t\t\t  <div class=\"mb-3 col-12 mb-3\">\n\t\t\t\t<label class=\"col-form-label\" for=\"email\">Email Address <span class=\"text-danger text-small\">*</span>\n\t\t\t\t</label>\n\t\t\t\t<input type=\"email\" class=\"form-control\" id=\"email\" name=\"email\" value=\"\" required=\"\">\n\t\t\t  </div>\n\t\t\t  \n\n\t\t\t  <div class=\"mb-3\">\n\t\t\t\t<div class=\" \" data-v-if-not=\"this.global.user_id\">\n\t\t\t\t  <div class=\"form-check form-check-inline\">\n\t\t\t\t\t<label class=\"form-check-label\" for=\"register-account-check\">\n\t\t\t\t\t  <input class=\"form-check-input\" type=\"radio\" value=\"true\" id=\"register-account-check\" name=\"register\" checked=\"\" onclick=\"toggleRegister(this)\">\n\t\t\t\t\t  <span>Register account</span>\n\t\t\t\t\t</label>\n\t\t\t\t  </div>\n\n\t\t\t\t  <div class=\"form-check form-check-inline\">\n\t\t\t\t\t<label class=\"form-check-label\" for=\"guest-check\">\n\t\t\t\t\t  <input class=\"form-check-input\" type=\"radio\" value=\"false\" id=\"guest-check\" name=\"register\" onclick=\"toggleRegister(this)\">\n\t\t\t\t\t  <span>Guest checkout</span>\n\t\t\t\t\t</label>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"row mb-3 register-account \" id=\"register-account\" data-v-if-not=\"this.global.user_id\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"register-password\">Password</label>\n\n\t\t\t\t  <div class=\"input-group\">\n\t\t\t\t\t<input type=\"password\" minlength=\"4\" autocorrect=\"off\" autocomplete=\"current-password\" class=\"form-control\" placeholder=\"Password\" id=\"register-password\" name=\"password\" value=\"\" aria-label=\"Password\" required=\"\">\n\t\t\t\t\t<div class=\"input-group-append\">\n\t\t\t\t\t  <button class=\"btn px-3 border border-start-0\" type=\"button\" onclick=\"togglePasswordInput(this,'register-password')\">\n\t\t\t\t\t\t<i class=\"la la-eye-slash\"></i>\n\t\t\t\t\t  </button>\n\t\t\t\t\t</div>\n\t\t\t\t  </div>\n\t\t\t\t</div>                      </div>\n\n\n\t\t\t</div>\n\t\t\t<div class=\"row\" data-v-component-address=\"\">                      \n\n\t\t\t  \n\t\t\t  <div class=\"billing_address\">\n\t\t\t\t<h5>Billing Address</h5>\n\n\t\t\t\t<div class=\"row\">\n\t\t\t\t  \n\t\t\t\t  <div class=\"mb-3 col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"billing_company\">Company Name</label>\n\t\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"billing_company\" name=\"billing_address[company]\" value=\"\">\n\t\t\t\t  </div>\n\n\t\t\t\t  <div class=\"col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"country\">Country <span class=\"text-danger text-small\">*</span>\n\t\t\t\t\t</label>\n\t\t\t\t\t<select class=\"form-select\" id=\"billing_country_id\" name=\"billing_address[country_id]\" data-v-countries=\"\" required=\"\" data-v-region-id=\"0\">\n\t\t\t\t\t  <option value=\"222\" data-v-option=\"\">United Kingdom</option><option value=\"223\" data-v-option=\"\">United States</option>                              \n\t\t\t\t\t</select>\n\t\t\t\t  </div>\n\t\t\t\t  <div class=\"col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"country\">region <span class=\"text-danger text-small\">*</span>\n\t\t\t\t\t</label>\n\t\t\t\t\t<select class=\"form-select\" id=\"billing_region_id\" name=\"billing_address[region_id]\" data-v-regions=\"\" required=\"\"><option value=\"3513\">Aberdeen</option></select>\n\t\t\t\t  </div>\n\t\t\t\t  <div class=\"col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"street_address\">Address <span class=\"text-danger text-small\">*</span>\n\t\t\t\t\t</label>\n\t\t\t\t\t<input type=\"text\" class=\"form-control mb-3\" id=\"billing_address_1\" name=\"billing_address[address_1]\" value=\"\" placeholder=\"Street address\" minlength=\"5\" required=\"\">\n\t\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"billing_address_2\" name=\"billing_address[address_2]\" placeholder=\"Apartment, suite, unit etc. (optional)\" minlength=\"3\" value=\"\">\n\t\t\t\t  </div>\n\t\t\t\t  <div class=\"col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"post_code\">Postcode <span class=\"text-danger text-small\">*</span>\n\t\t\t\t\t</label>\n\t\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"billing_post_code\" name=\"billing_address[post_code]\" minlength=\"3\" value=\"\">\n\t\t\t\t  </div>\n\t\t\t\t  <div class=\"col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"city\">Town/City <span class=\"text-danger text-small\">*</span>\n\t\t\t\t\t</label>\n\t\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"billing_city\" name=\"billing_address[city]\" minlength=\"3\" value=\"\" required=\"\">\n\t\t\t\t  </div>\n\t\t\t\t  <div class=\"col-12 mb-3\">\n\t\t\t\t\t<label class=\"col-form-label\" for=\"phone_number\">Phone No <span class=\"text-danger text-small\">*</span>\n\t\t\t\t\t</label>\n\t\t\t\t\t<input type=\"text\" class=\"form-control\" id=\"phone_number\" name=\"phone_number\" min=\"0\" placeholder=\"Phone number\" minlength=\"3\" value=\"\">\n\t\t\t\t  </div>\n\n\t\t\t\t</div>\n\t\t\t  </div>\n\n\t\t\t</div>\n\n\n\t\t\t<div class=\"form-check mb-1 form-control-lg\">\n\t\t\t  <input class=\"form-check-input\" type=\"checkbox\" value=\"true\" id=\"shipping-form-check\" name=\"no_shipping\" onclick=\"toggleShippingAddress(this)\">\n\t\t\t  <label class=\"form-check-label text-small\" for=\"shipping-form-check\">\nShip To A Different Address </label>\n\t\t\t</div>\n\n\t\t\t<div id=\"checkout-shipping-container\" class=\"shipping_address mb-2\" style=\"display: none;\">\n\t\t\t  <h5>Shipping Address</h5>\n\n\t\t\t  <div class=\"row\">\n\t\t\t\t<div class=\"mb-3 col-6\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"first_name\">First Name <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"first_name\" name=\"shipping_address[first_name]\" value=\"\" minlength=\"3\" required=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"mb-3 col-6\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"last_name\">Last Name <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"last_name\" name=\"shipping_address[last_name]\" value=\"\" minlength=\"3\" required=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"mb-3 col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"email\">Email Address <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"email\" class=\"form-control\" id=\"email\" name=\"shipping_address[email]\" value=\"\" required=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"mb-3 col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"company\">Company Name</label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"company\" name=\"shipping_address[company]\" value=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"country\">Country <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <select class=\"form-select\" id=\"shipping_country_id\" name=\"shipping_address[country_id]\" data-v-countries=\"\" disabled=\"\">\n\t\t\t\t\t<option value=\"222\" data-v-country=\"\" data-v-country-country_id=\"\">\n\t\t\t\t\t  United Kingdom\n\t\t\t\t\t</option><option value=\"223\" data-v-country=\"\" data-v-country-country_id=\"\">\n\t\t\t\t\t  United States\n\t\t\t\t\t</option>                            \n\t\t\t\t  </select>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"country\">region <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <select class=\"form-select\" id=\"shipping_region_id\" name=\"shipping_address[region_id]\" data-v-regions=\"\"><option value=\"3513\">Aberdeen</option></select>\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"street_address\">Address <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control mb-3\" id=\"shipping_shipping_address_1\" name=\"shipping_address[address_1]\" value=\"\" placeholder=\"Street address\" minlength=\"5\" required=\"\" disabled=\"\">\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"shipping_shipping_address_2\" name=\"shipping_address[address_2]\" placeholder=\"Apartment, suite, unit etc. (optional)\" minlength=\"3\" value=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"post_code\">Postcode <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"shipping_post_code\" name=\"shipping_address[post_code]\" minlength=\"3\" value=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"city\">Town/City <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"shipping_city\" name=\"shipping_address[city]\" minlength=\"3\" value=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"state\">Province <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"shipping_region_id\" name=\"shipping_address[region_id]\" minlength=\"3\" value=\"\" disabled=\"\">\n\t\t\t\t</div>\n\t\t\t\t<div class=\"col-12 mb-3\">\n\t\t\t\t  <label class=\"col-form-label\" for=\"phone_number\">Phone No <span class=\"text-danger text-small\">*</span>\n\t\t\t\t  </label>\n\t\t\t\t  <input type=\"text\" class=\"form-control\" id=\"phone_number\" name=\"shipping_address[phone_number]\" min=\"0\" placeholder=\"Phone number\" minlength=\"3\" value=\"\" disabled=\"\">\n\t\t\t\t</div>\n\n\t\t\t  </div>\n\t\t\t</div>\n\n\t\t\t<div class=\"mb-3\">\n\t\t\t  <div class=\"form-check mb-1\">\n\t\t\t\t<input type=\"checkbox\" class=\"form-check-input\" id=\"terms\" name=\"terms\" required=\"\">\n\t\t\t\t<label class=\"form-check-label\" for=\"terms\">\nI agree to <a href=\"/page/terms-conditions\" target=\"_blank\" data-v-url=\"content/page/index\" data-v-url-params=\"{&quot;slug&quot;:&quot;terms-conditions&quot;}\">Terms and conditions</a>\n\t\t\t\t</label>\n\t\t\t  </div>\n\t\t\t  <div class=\"form-check mb-1\">\n\t\t\t\t<input type=\"checkbox\" class=\"form-check-input\" id=\"newsletter\" name=\"newsletter\">\n\t\t\t\t<label class=\"form-check-label\" for=\"newsletter\">Subscribe to our newsletter</label>\n\t\t\t  </div>\n\t\t\t</div>\n\n\t\t  </div>\n\t\t</div>\n\t  </div>\n\n\t  <div class=\"col-12 col-md-5 ms-lg-auto\">\n\t\t<div class=\"card\">\n\t\t  <div class=\"card-body\">\n\n\t\t\t<div data-v-component-cart=\"\">                      <div class=\"table-responsive mb-3\">\n\t\t\t\t<table class=\"table align-middle mb-0\">\n\t\t\t\t  <tbody>\n\n\t\t\t\t\t<tr data-v-cart-product=\"\" data-product_id=\"19\">\n\t\t\t\t\t  <td class=\"text-center\">\n\t\t\t\t\t\t<a href=\"/checkout?module=product&amp;product_id=19\" data-v-cart-product-url=\"\">\n\t\t\t\t\t\t  <img src=\"/public/media/demo/products/9-1.jpg\" alt=\"iPhone\" class=\"img-rounded\" data-v-cart-product-image=\"\" width=\"50\">\n\t\t\t\t\t\t</a>\n\t\t\t\t\t  </td>\n\t\t\t\t\t  <td class=\"text-center\">\n\t\t\t\t\t\t<a href=\"/checkout?module=product&amp;product_id=19\" class=\"d-block\" data-v-cart-product-url=\"\" data-v-cart-product-name=\"\">Product 19</a>\n\t\t\t\t\t  </td>\n\t\t\t\t\t  <td class=\"text-end\">\n\t\t\t\t\t\t<span class=\"text-small\">\n\t\t\t\t\t\t  <span data-v-cart-product-quantity=\"\">1</span>\n\t\t\t\t\t\t  <span class=\"text-muted\">x</span>\n\t\t\t\t\t\t  <span data-v-cart-product-price_tax_formatted=\"\">$217.9891</span>\n\t\t\t\t\t\t</span>\n\t\t\t\t\t  </td>\n\n\t\t\t\t\t</tr><tr data-v-cart-product=\"\" data-product_id=\"18\">\n\t\t\t\t\t  <td class=\"text-center\">\n\t\t\t\t\t\t<a href=\"/checkout?module=product&amp;product_id=18\" data-v-cart-product-url=\"\">\n\t\t\t\t\t\t  <img src=\"/public/media/demo/products/8-1.jpg\" alt=\"iPhone\" class=\"img-rounded\" data-v-cart-product-image=\"\" width=\"50\">\n\t\t\t\t\t\t</a>\n\t\t\t\t\t  </td>\n\t\t\t\t\t  <td class=\"text-center\">\n\t\t\t\t\t\t<a href=\"/checkout?module=product&amp;product_id=18\" class=\"d-block\" data-v-cart-product-url=\"\" data-v-cart-product-name=\"\">Product 18</a>\n\t\t\t\t\t  </td>\n\t\t\t\t\t  <td class=\"text-end\">\n\t\t\t\t\t\t<span class=\"text-small\">\n\t\t\t\t\t\t  <span data-v-cart-product-quantity=\"\">1</span>\n\t\t\t\t\t\t  <span class=\"text-muted\">x</span>\n\t\t\t\t\t\t  <span data-v-cart-product-price_tax_formatted=\"\">$109</span>\n\t\t\t\t\t\t</span>\n\t\t\t\t\t  </td>\n\n\t\t\t\t\t</tr>                            \n\t\t\t\t\n\t\t\t\t </tbody>\n\n\t\t\t\t</table>\n\t\t\t  </div>\n\n\t\t\t  <div class=\"p-3 pt-0 \" data-v-if=\"cart.total_items\">\n\t\t\t\t<div class=\"table-responsive mb-2\" data-v-cart-totals=\"\">\n\t\t\t\t  <table class=\"table mb-0 cart-table cart-total\" cellspacing=\"0\">\n\t\t\t\t\t<tfoot>\n\t\t\t\t\t  <tr data-v-cart-total=\"\">\n\t\t\t\t\t\t<td colspan=\"5\" class=\"text-end\">\n\t\t\t\t\t\t  <small data-v-cart-total-title=\"\">Sub-total</small>: </td>\n\t\t\t\t\t\t<td class=\"text-end\">\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t<span data-v-cart-total-value_formatted=\"\" data-v-if=\"total.value > 0\" class=\" \">$299</span>                                \n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t</td>\n\t\t\t\t\t  </tr><tr data-v-cart-total=\"\">\n\t\t\t\t\t\t<td colspan=\"5\" class=\"text-end\">\n\t\t\t\t\t\t  <small data-v-cart-total-title=\"\">Flat rate shipping</small>: </td>\n\t\t\t\t\t\t<td class=\"text-end\">\n\t\t\t\t\t\t  <span data-v-cart-total-text=\"\" data-v-if=\"total.text\" class=\" \">Free shipping</span>                                                                  \n\t\t\t\t\t\t  </td>\n\t\t\t\t\t  </tr><tr data-v-cart-total=\"\">\n\t\t\t\t\t\t<td colspan=\"5\" class=\"text-end\">\n\t\t\t\t\t\t  <small data-v-cart-total-title=\"\">Pick up shipping</small>: </td>\n\t\t\t\t\t\t<td class=\"text-end\">\n\t\t\t\t\t\t  <span data-v-cart-total-text=\"\" data-v-if=\"total.text\" class=\" \">Free shipping</span>                                                                  \n\t\t\t\t\t\t  </td>\n\t\t\t\t\t  </tr><tr data-v-cart-total=\"\">\n\t\t\t\t\t\t<td colspan=\"5\" class=\"text-end\">\n\t\t\t\t\t\t  <small data-v-cart-total-title=\"\">VAT (9%)</small>: </td>\n\t\t\t\t\t\t<td class=\"text-end\">\n\t\t\t\t\t\t\t<span data-v-cart-total-value_formatted=\"\" data-v-if=\"total.value > 0\" class=\" \">$26.9991</span>                                \n\t\t\t\t\t\t\t</td>\n\t\t\t\t\t  </tr>                              \n\t\t\t\t\t  \n\t\t\t\t\t  \n\t\t\t\t\t  <tr>\n\t\t\t\t\t\t<td colspan=\"5\" class=\"text-end\">Total:</td>\n\t\t\t\t\t\t<td class=\"text-end\" data-v-grand-total_formatted=\"\">$325.9991</td>\n\t\t\t\t\t  </tr>\n\t\t\t\t\t</tfoot>\n\n\t\t\t\t  </table>\n\t\t\t\t</div>\n\n\t\t\t  </div>                    \n\t\t\t  </div>\n\n\n\t\t\t<div class=\"input-group mb-3\">\n\t\t\t  <input type=\"text\" class=\"form-control\" id=\"coupon_code\" placeholder=\"Coupon Code\" aria-label=\"Coupon Code\" aria-describedby=\"button-addon2\" value=\"\">\n\t\t\t  <button class=\"btn btn-primary btn-sm px-4\" type=\"button\">Apply</button>\n\t\t\t</div>\n\n\t\t\t<h6>Shipping</h6>\n\t\t\t<div id=\"accordion\" name=\"accordion\" role=\"tablist\" class=\"accordion mb-3\" data-v-component-checkout-shipping=\"\">\n\t\t\t  <div class=\"accordion-item\" data-v-shipping=\"\" data-shipping_id=\"\">\n\t\t\t\t<div class=\"accordion-header\" role=\"tab\">\n\t\t\t\t  <label class=\"form-check-label accordion-button collapsed\" aria-expanded=\"false\" role=\"button\">\n\t\t\t\t\t<input class=\"form-check-input me-2\" type=\"radio\" name=\"shipping_method\" value=\"flat-rate\" data-v-shipping-name=\"\" required=\"\">\n\t\t\t\t\t<span data-v-shipping-title=\"\">Flat rate</span>\n\t\t\t\t  </label>\n\t\t\t\t</div>\n\n\t\t\t\t<div class=\"collapse\" role=\"tabpanel\">\n\t\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t\t<p>\n\t\t\t\t\t  <span data-v-shipping-description=\"\">Fixed shipping rate</span>\n\t\t\t\t\t</p>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t  </div><div class=\"accordion-item\" data-v-shipping=\"\" data-shipping_id=\"\">\n\t\t\t\t<div class=\"accordion-header\" role=\"tab\">\n\t\t\t\t  <label class=\"form-check-label accordion-button collapsed\" aria-expanded=\"false\" role=\"button\">\n\t\t\t\t\t<input class=\"form-check-input me-2\" type=\"radio\" name=\"shipping_method\" value=\"Pick up\" data-v-shipping-name=\"\" required=\"\">\n\t\t\t\t\t<span data-v-shipping-title=\"\">Pick up</span>\n\t\t\t\t  </label>\n\t\t\t\t</div>\n\n\t\t\t\t<div class=\"collapse\" role=\"tabpanel\">\n\t\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t\t<p>\n\t\t\t\t\t  <span data-v-shipping-description=\"\">Pick up from store</span>\n\t\t\t\t\t</p>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t  </div><div class=\"accordion-item\" data-v-shipping=\"\" data-shipping_id=\"\">\n\t\t\t\t<div class=\"accordion-header\" role=\"tab\">\n\t\t\t\t  <label class=\"form-check-label accordion-button collapsed\" aria-expanded=\"false\" role=\"button\">\n\t\t\t\t\t<input class=\"form-check-input me-2\" type=\"radio\" name=\"shipping_method\" value=\"weight-shipping\" data-v-shipping-name=\"\" required=\"\">\n\t\t\t\t\t<span data-v-shipping-title=\"\">Weight shipping</span>\n\t\t\t\t  </label>\n\t\t\t\t</div>\n\n\t\t\t\t<div class=\"collapse\" role=\"tabpanel\">\n\t\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t\t<p>\n\t\t\t\t\t  <span data-v-shipping-description=\"\">Weight based shipping</span>\n\t\t\t\t\t</p>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t  </div>\n\t\t\t  \n\n\t\t\t  \n\t\t\t</div>\n\n\n\t\t\t<h6>Payment</h6>\n\t\t\t<div id=\"accordion\" name=\"accordion\" role=\"tablist\" class=\"accordion mb-3\" data-v-component-checkout-payment=\"\">\n\t\t\t  <div class=\"accordion-item\" data-v-payment=\"\" data-payment_id=\"\">\n\t\t\t\t<div class=\"accordion-header\" role=\"tab\">\n\t\t\t\t  <label class=\"form-check-label accordion-button collapsed\" aria-expanded=\"false\" role=\"button\">\n\t\t\t\t\t<input class=\"form-check-input me-2\" type=\"radio\" name=\"payment_method\" value=\"bank-transfer\" data-v-payment-name=\"\" required=\"\">\n\t\t\t\t\t<span data-v-payment-title=\"\">Bank transfer</span>\n\t\t\t\t  </label>\n\t\t\t\t</div>\n\n\t\t\t\t<div class=\"collapse\" role=\"tabpanel\">\n\t\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t\t<p>\n\t\t\t\t\t  <span data-v-payment-description=\"\">Bank transfer details</span>\n\t\t\t\t\t</p>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t  </div><div class=\"accordion-item\" data-v-payment=\"\" data-payment_id=\"\">\n\t\t\t\t<div class=\"accordion-header\" role=\"tab\">\n\t\t\t\t  <label class=\"form-check-label accordion-button collapsed\" aria-expanded=\"false\" role=\"button\">\n\t\t\t\t\t<input class=\"form-check-input me-2\" type=\"radio\" name=\"payment_method\" value=\"cash-on-delivery\" data-v-payment-name=\"\" required=\"\">\n\t\t\t\t\t<span data-v-payment-title=\"\">Cash on delivery</span>\n\t\t\t\t  </label>\n\t\t\t\t</div>\n\n\t\t\t\t<div class=\"collapse\" role=\"tabpanel\">\n\t\t\t\t  <div class=\"accordion-body\">\n\t\t\t\t\t<p>\n\t\t\t\t\t  <span data-v-payment-description=\"\">Pay cash on delivery</span>\n\t\t\t\t\t</p>\n\t\t\t\t  </div>\n\t\t\t\t</div>\n\t\t\t  </div>                      \n\n\n\t\t\t\t</div>\n\n\n\t\t\t<div class=\"mb-3\">\n\t\t\t  <label for=\"comment\">Order Notes</label>\n\t\t\t  <textarea name=\"comment\" id=\"comment\" cols=\"30\" rows=\"5\" class=\"form-control\" placeholder=\"\"></textarea>\n\t\t\t</div>\n\n\t\t\t<button type=\"submit\" href=\"\" class=\"btn btn-primary w-100\" data-v-url=\"checkout/checkout/confirm\">\nPlace order <i class=\"la la-arrow-right\"></i>\n\t\t\t</button>\n\t\t  </div>\n\t\t</div>\n\t  </div>\n\t</div>\n  </div>\n</form>\n",
    "properties": []
  },
  "filtersComponent": {
    "name": "Filters",
    "attributes": [
      "data-v-component-filters"
    ],
    "image": "icons/filters.svg",
    "html": "<div class=\"widget mt-5\" data-v-component-filters>\n  <span class=\"d-flex text-muted mb-2\">Color</span>\n  <ul class=\"list-unstyled\">\n\t<li>\n\t  <div class=\"form-check form-check-color\">\n\t\t<input class=\"form-check-input\" type=\"checkbox\" value=\"\" id=\"color-1\">\n\t\t<label class=\"form-check-label\" for=\"color-1\">\n\t\t  <span class=\"bg-red\"></span> Red\n\t\t</label>\n\t  </div>\n\t</li>\n\t<li class=\"mt-1\">\n\t  <div class=\"form-check form-check-color\">\n\t\t<input class=\"form-check-input\" type=\"checkbox\" value=\"\" id=\"color-2\">\n\t\t<label class=\"form-check-label\" for=\"color-2\">\n\t\t  <span class=\"bg-blue\"></span> Blue\n\t\t</label>\n\t  </div>\n\t</li>\n\t<li class=\"mt-1\">\n\t  <div class=\"form-check form-check-color\">\n\t\t<input class=\"form-check-input\" type=\"checkbox\" value=\"\" id=\"color-3\">\n\t\t<label class=\"form-check-label\" for=\"color-3\">\n\t\t  <span class=\"bg-green\"></span> Green\n\t\t</label>\n\t  </div>\n\t</li>\n\t<li class=\"mt-1\">\n\t  <div class=\"form-check form-check-color\">\n\t\t<input class=\"form-check-input\" type=\"checkbox\" value=\"\" id=\"color-4\">\n\t\t<label class=\"form-check-label\" for=\"color-4\">\n\t\t  <span class=\"bg-yellow\"></span> Yellow\n\t\t</label>\n\t  </div>\n\t</li>\n  </ul>\n</div>\n",
    "properties": [
      {
        "name": false,
        "key": "type",
        "inputtype": "RadioButtonInput",
        "htmlAttr": "data-v-type",
        "data": {
          "inline": true,
          "extraclass": "btn-group-fullwidth",
          "options": [
            {
              "value": "autocomplete",
              "text": "Autocomplete import",
              "title": "Autocomplete",
              "icon": "la la-search",
              "extraclass": "btn-sm",
              "checked": true
            },
            {
              "value": "automatic",
              "icon": "la la-cog",
              "text": "Configuration",
              "title": "Configuration",
              "extraclass": "btn-sm"
            }
          ]
        },
        "setGroup": "[function]",
        "onChange": "[function]",
        "init": "[function]"
      },
      {
        "name": "Filters",
        "key": "filters",
        "group": "autocomplete",
        "htmlAttr": "data-v-filters",
        "inline": true,
        "col": 12,
        "inputtype": "[function]",
        "data": {
          "url": "/?module=editor&action=filtersAutocomplete"
        }
      },
      {
        "name": "Nr. of filters",
        "group": "automatic",
        "col": 6,
        "inline": true,
        "key": "limit",
        "htmlAttr": "data-v-limit",
        "inputtype": "NumberInput",
        "data": {
          "value": "8",
          "min": "1",
          "max": "1024",
          "step": "1"
        },
        "getFromNode": "[function]"
      },
      {
        "name": "Start from page",
        "group": "automatic",
        "col": 6,
        "inline": true,
        "key": "page",
        "htmlAttr": "data-v-page",
        "data": {
          "value": "1",
          "min": "1",
          "max": "1024",
          "step": "1"
        },
        "inputtype": "NumberInput",
        "getFromNode": "[function]"
      },
      {
        "name": "Order by",
        "group": "automatic",
        "key": "order",
        "htmlAttr": "data-v-order",
        "inputtype": "SelectInput",
        "data": {
          "options": [
            {
              "value": "price_asc",
              "text": "Price Ascending"
            },
            {
              "value": "price_desc",
              "text": "Price Descending"
            },
            {
              "value": "date_asc",
              "text": "Date Ascending"
            },
            {
              "value": "date_desc",
              "text": "Date Descending"
            },
            {
              "value": "sales_asc",
              "text": "Sales Ascending"
            },
            {
              "value": "sales_desc",
              "text": "Sales Descending"
            }
          ]
        }
      },
      {
        "name": "Category",
        "group": "automatic",
        "key": "category",
        "htmlAttr": "data-v-category",
        "inline": true,
        "col": 12,
        "inputtype": "TagsInput",
        "data": {
          "url": "/?module=editor&action=filtersAutocomplete"
        }
      },
      {
        "name": "Manufacturer",
        "group": "automatic",
        "key": "manufacturer",
        "htmlAttr": "data-v-manufacturer",
        "inline": true,
        "col": 12,
        "inputtype": "TagsInput",
        "data": {
          "url": "/?module=editor&action=filtersAutocomplete"
        }
      },
      {
        "name": "Manufacturer 2",
        "group": "automatic",
        "key": "manufacturer 2",
        "htmlAttr": "data-v-manufacturer2",
        "inline": true,
        "col": 12,
        "inputtype": "TagsInput",
        "data": {
          "url": "/?module=editor&action=filtersAutocomplete"
        }
      }
    ]
  }
} as const;
