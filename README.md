# badges
 
Show badges depending on relationships. Can be used to implement tags or likes.

# how to use plugin

1. Install this module (captcha in the Saltcorn module store).
2. Create tables for use by the plugin. For example, if we want to display tags for our blog posts, we'll create tables:
* posts - our blog posts,
* tags and
* post_tags - multiple relations between posts and tags. 
3. Use View Patterns from plugin for tags or likes implementation.

# Impelemented View Patterns 

* Badges - shows badges for entity 
* EditBadge - allows to edit badges for entity
* LikeBadge - like functionality

# known limitations

* Plugin view patterns do not check the user's role, so it is recommended to use for authorized users.
The only exception is LikeBadge. With it, you can count likes for unauthorized users.




   
