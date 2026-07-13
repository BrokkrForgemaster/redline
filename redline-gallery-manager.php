<?php
/**
 * Plugin Name: Redline Gallery Manager
 * Description: Adds a dedicated "Gallery" section to your WordPress dashboard to manage website photos.
 * Version: 1.0
 * Author: Redline Landscaping
 */

// Exit if accessed directly
if (!defined('ABSPATH')) exit;

/**
 * Register Gallery Custom Post Type and Taxonomy
 */
function redline_register_gallery_manager() {
    // 1. Register Taxonomy (Categories)
    register_taxonomy('gallery_category', 'gallery', array(
        'label'        => 'Gallery Categories',
        'rewrite'      => array('slug' => 'gallery-category'),
        'hierarchical' => true,
        'show_in_rest' => true, // Important for the API
        'labels' => array(
            'name' => 'Categories',
            'singular_name' => 'Category',
        ),
    ));

    // 2. Register Post Type
    register_post_type('gallery', array(
        'labels'      => array(
            'name'          => 'Gallery',
            'singular_name' => 'Gallery Item',
            'add_new_item'  => 'Add New Gallery Photo',
            'edit_item'     => 'Edit Gallery Photo',
            'all_items'     => 'All Photos',
        ),
        'public'      => true,
        'has_archive' => false,
        'menu_icon'   => 'dashicons-format-image',
        'supports'    => array('title', 'thumbnail'), // Title = caption, Thumbnail = photo
        'show_in_rest' => true, // Important for the API
        'taxonomies'  => array('gallery_category'),
    ));
}
add_action('init', 'redline_register_gallery_manager');

/**
 * Add featured image column to Gallery admin list so you can see the photos
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
        echo get_the_post_thumbnail($post_id, array(80, 80), array('style' => 'border-radius: 4px;'));
    }
}
add_action('manage_gallery_posts_custom_column', 'redline_gallery_column_content', 10, 2);

/**
 * Add some helpful text to the Gallery page
 */
function redline_gallery_help_text() {
    $screen = get_current_screen();
    if ($screen->post_type !== 'gallery') return;

    echo '<div class="notice notice-info"><p><strong>How to use:</strong> The <strong>Title</strong> you enter will be the caption on the website. Be sure to set a <strong>Featured Image</strong> and select at least one <strong>Category</strong> (lawn-care, landscaping, or snow-removal).</p></div>';
}
add_action('admin_notices', 'redline_gallery_help_text');
