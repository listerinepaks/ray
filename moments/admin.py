from django.contrib import admin

from .models import Comment, Moment, MomentAccess, MomentPerson, MomentPhoto, Person, Reaction


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
    list_display = ("id", "kind", "date", "author", "visibility_mode", "created_at")
    list_filter = ("kind", "visibility_mode")
    search_fields = ("title", "reflection", "location_name")
    inlines = [MomentPhotoInline, MomentPersonInline, MomentAccessInline]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "moment", "author", "created_at")


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "moment", "user", "type", "created_at")
