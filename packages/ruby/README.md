This is the ruby gem that can be used to load things from Google Drive.

### Test

```sh
gem build require_from_drive.gemspec && gem install --local require_from_drive && ruby test.rb
```

### Publish

1. Make the appropriate semantic versioning version bump in the `.gemspec` file
2. Test
3. Push: `gem push require_from_drive-<version>.gem`, where you replace `version` with the latest version. Testing should have caused the latest version to be built for you.
