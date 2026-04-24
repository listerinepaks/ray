from django.contrib import admin

from .models import Comment, Friendship, Moment, MomentAccess, MomentPerson, MomentPhoto, Person, Reaction


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_by", "linked_user", "created_at")
    search_fields = ("name",)


class MomentPhotoInline(admin.TabularInline):
    model = MomentPhoto
    extra = 0


class MomentPersonInline(admin.TabularInline):
    model = MomentPerson
    extra = 0


class MomentAccessInline(admin.TabularInline):
    model = MomentAccess
    extra = 0


@admin.register(Moment)
class MomentAdmin(admin.ModelAdmin):
    list_display = ("id", "moment_type", "kind", "date", "author", "visibility_mode", "created_at")
    list_filter = ("moment_type", "kind", "visibility_mode")
    search_fields = ("title", "bible_verse", "reflection", "location_name")
    inlines = [MomentPhotoInline, MomentPersonInline, MomentAccessInline]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "moment", "author", "created_at")


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "moment", "user", "type", "created_at")


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ("id", "requester", "addressee", "status", "created_at", "accepted_at")
    list_filter = ("status",)
