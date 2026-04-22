from storages.backends.s3 import S3Storage


class PrivateMediaStorage(S3Storage):
    default_acl = None
    file_overwrite = False
    querystring_auth = True
