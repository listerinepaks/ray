from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.admin.sites import NotRegistered

from .models import Comment, Friendship, Moment, MomentAccess, MomentPerson, MomentPhoto, Person, Reaction
from .user_profiles import ensure_linked_person_for_user


User = get_user_model()


class PersonProfileInline(admin.StackedInline):
    model = Person
    fk_name = "linked_user"
    fields = ("name", "note", "profile_photo", "created_by", "created_at")
    readonly_fields = ("created_by", "created_at")
    can_delete = False
    max_num = 1
    show_change_link = True

    def get_extra(self, request, obj=None, **kwargs):
        if obj is None:
            return 0
        return 0 if Person.objects.filter(linked_user=obj).exists() else 1


@admin.action(description="Create linked person profiles for selected users")
def create_missing_person_profiles(modeladmin, request, queryset):
    created = 0
    for user in queryset:
        _, was_created = ensure_linked_person_for_user(user)
        if was_created:
            created += 1
    modeladmin.message_user(
        request,
        f"Created {created} linked person profile{'s' if created != 1 else ''}.",
    )


try:
    admin.site.unregister(User)
except NotRegistered:
    pass


@admin.register(User)
class RayUserAdmin(BaseUserAdmin):
    inlines = [PersonProfileInline]
    actions = [create_missing_person_profiles]

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("person_links")

    @admin.display(description="Person", ordering="person_links__name")
    def linked_person(self, obj):
        try:
            return obj.person_links.name
        except Person.DoesNotExist:
            return "-"

    def get_list_display(self, request):
        display = list(super().get_list_display(request))
        if "linked_person" not in display:
            display.append("linked_person")
        return display

    def save_formset(self, request, form, formset, change):
        if formset.model is Person:
            instances = formset.save(commit=False)
            for obj in instances:
                obj.linked_user = form.instance
                if obj.created_by_id is None:
                    obj.created_by = form.instance
                obj.save()
            formset.save_m2m()
            return
        super().save_formset(request, form, formset, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        ensure_linked_person_for_user(form.instance)


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_by", "linked_user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("name", "linked_user__username", "linked_user__email")


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
