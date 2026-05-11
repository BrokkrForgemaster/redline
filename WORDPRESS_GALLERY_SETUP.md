# WordPress Gallery Setup Instructions

To manage your website gallery directly from WordPress, follow these steps. This setup creates a dedicated "Gallery" section in your WordPress dashboard, making it easy to add, update, and remove pictures.

## 1. Add the Gallery Custom Post Type

Copy and paste the following code into your WordPress theme's `functions.php` file, or use a plugin like "Code Snippets".

```php
<?php
/**
 * Register Gallery Custom Post Type and Taxonomy
 */
function redline_register_gallery_cpt() {
    // 1. Register Taxonomy (Categories)
    register_taxonomy('gallery_category', 'gallery', array(
        'label'        => 'Gallery Categories',
        'rewrite'      => array('slug' => 'gallery-category'),
        'hierarchical' => true,
        'show_in_rest' => true, // Important for the API
    ));

    // 2. Register Post Type
    register_post_type('gallery', array(
        'labels'      => array(
            'name'          => 'Gallery',
            'singular_name' => 'Gallery Item',
            'add_new_item'  => 'Add New Gallery Photo',
        ),
        'public'      => true,
        'has_archive' => false,
        'menu_icon'   => 'dashicons-format-image',
        'supports'    => array('title', 'thumbnail'), // Title is caption, Thumbnail is the photo
        'show_in_rest' => true, // Important for the API
        'taxonomies'  => array('gallery_category'),
    ));
}
add_action('init', 'redline_register_gallery_cpt');

/**
 * Add featured image column to Gallery admin list
 */
function redline_add_gallery_columns($columns) {
    $new_columns = array();
    foreach($columns as $key => $value) {
        if ($key == 'title') {
            $new_columns['gallery_image'] = 'Image';
        }
        $new_columns[$key] = $value;
    }
    return $new_columns;
}
add_filter('manage_gallery_posts_columns', 'redline_add_gallery_columns');

function redline_gallery_column_content($column, $post_id) {
    if ($column == 'gallery_image') {
        echo get_the_post_thumbnail($post_id, array(80, 80));
    }
}
add_action('manage_gallery_posts_custom_column', 'redline_gallery_column_content', 10, 2);
```

## 2. Managing the Gallery

Once the code is added, you will see a **Gallery** menu item in your WordPress dashboard.

### To Add a Photo:
1. Go to **Gallery > Add New**.
2. **Title**: Enter a caption for the photo (e.g., "Professional Lawn Striping").
3. **Featured Image**: Upload or select the photo you want to display.
4. **Gallery Categories**: Select one or more categories:
   - `lawn-care`
   - `landscaping`
   - `snow-removal`
5. Click **Publish**.

### To Update a Photo:
- Go to **Gallery**, find the item, and edit the Title, Image, or Categories.

### To Remove a Photo:
- Go to **Gallery** and move the item to the **Trash**.

---

## Alternative (Zero-Config)
If you don't want to add the code above, you can still use regular WordPress **Posts**:
1. Create a category called **Gallery**.
2. Create a post for each photo.
3. Set the **Featured Image**.
4. Set the **Category** to "Gallery".
5. Use **Tags** for the filtering (`lawn-care`, `landscaping`, `snow-removal`).
