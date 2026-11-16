# Stage Markdown as Jekyll pages while keeping _posts as the writing folder.
require "date"
require "fileutils"
require "pathname"
require "yaml"

root = Pathname.new(__dir__).parent
source = root / "_posts"
abort "Usage: ruby scripts/stage.rb /path/to/empty-staging-directory" unless ARGV.length == 1
destination = Pathname.new(ARGV.fetch(0)).expand_path
abort "Use a new or empty staging directory" if destination.exist? && (!destination.directory? || !destination.children.empty?)
FileUtils.mkdir_p(destination)
%w[_config.yml _layouts assets index.html].each { |entry| FileUtils.cp_r(root / entry, destination) }

source.glob("**/*.md").sort.each do |file|
  relative = file.relative_path_from(source)
  path = relative.sub_ext("")
  parts = path.each_filename.to_a
  abort "Unsupported post path: #{relative}" if parts.any? { |part| part.empty? || part.match?(/[?#%:]/) }

  raw = file.read(encoding: "bom|utf-8")
  header = raw.match(/\A---[ \t]*\r?\n(.*?)^---[ \t]*\r?\n/m)
  data = header ? YAML.safe_load(header[1], permitted_classes: [Date, Time], aliases: false) || {} : {}
  abort "Invalid front matter: #{relative}" unless data.is_a?(Hash)
  body = header ? header.post_match : raw
  heading = body.match(/\A\s*#\s+([^\r\n]+)\r?\n/)
  if heading && !data["title"]
    data["title"] = heading[1].strip
    body = heading.post_match
  end
  data["title"] ||= parts.last
  data["layout"] = "post"
  data["permalink"] = "/" + parts.join("/") + "/"
  data["post_folders"] = parts[0...-1]

  target = destination / relative
  abort "Post path collides with a site file: #{relative}" if target.exist?
  FileUtils.mkdir_p(target.dirname)
  target.write(YAML.dump(data) + "---\n\n" + body, encoding: "utf-8")
end
