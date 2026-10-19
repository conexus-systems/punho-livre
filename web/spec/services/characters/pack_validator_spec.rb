# frozen_string_literal: true

require "rails_helper"

RSpec.describe Characters::PackValidator do
  def errors_for(pack)
    described_class.call(pack)
    []
  rescue described_class::Invalid => e
    e.details
  end

  it "accepts a valid pack and returns the exact body and its sha256" do
    pack = build_pack
    result = described_class.call(pack)

    expect(result.body).to eq(JSON.generate(pack))
    expect(result.sha256).to eq(Digest::SHA256.hexdigest(result.body))
    expect(result.size_bytes).to eq(result.body.bytesize)
  end

  it "rejects a wrong format and a bad id" do
    expect(errors_for(build_pack.merge("format" => "mugen/2"))).to include(/format/)
    expect(errors_for(build_pack.merge("id" => "Bad Id"))).to include(/id must match/)
    expect(errors_for(build_pack.merge("id" => "a"))).to include(/id must match/)
  end

  it "requires the def file to be present in files" do
    expect(errors_for(build_pack.merge("def" => "missing.def"))).to include(/def must name a file/)
  end

  it "requires every file referenced in [Files] (case-insensitive keys, ; comments)" do
    pack = build_pack
    pack["files"].delete("kaze.air")

    expect(errors_for(pack)).to include("[Files] anim = kaze.air is missing from files")
  end

  it "requires st* entries to be present" do
    pack = build_pack
    pack["files"]["kaze.def"] += "st2 = extra.cns\n"

    expect(errors_for(pack)).to include("[Files] st2 = extra.cns is missing from files")
  end

  it "resolves references relative to the def directory and with backslashes" do
    pack = build_pack(
      "def" => "kaze/kaze.def",
      "files" => {
        "kaze/kaze.def" => "[Files]\ncmd = kaze.cmd\ncns = data\\kaze.cns\nanim = KAZE.AIR\n",
        "kaze/kaze.cmd" => "", "kaze/data/kaze.cns" => "", "kaze/kaze.air" => ""
      }
    )

    expect(errors_for(pack)).to be_empty
  end

  it "requires cmd, cns and anim/air in [Files]" do
    pack = build_pack
    pack["files"]["kaze.def"] = "[Files]\ncns = kaze.cns\n"

    expect(errors_for(pack)).to include("[Files] must declare cmd", "[Files] must declare anim or air")
  end

  it "rejects unsafe paths" do
    pack = build_pack
    pack["files"]["../etc/passwd"] = "x"

    expect(errors_for(pack)).to include(/unsafe path/)
  end

  it "validates sprites" do
    good = { "atlas" => "data:image/png;base64,iVBORw0KGgo=", "frames" => { "0,0" => [ 0, 0, 32, 64, 16, 60 ] } }
    expect(errors_for(build_pack("sprites" => good))).to be_empty
    expect(errors_for(build_pack("sprites" => good.merge("atlas" => "http://x/a.png")))).to include(/atlas/)
    expect(errors_for(build_pack("sprites" => good.merge("frames" => { "0,0" => [ 1, 2 ] })))).to include(/frames/)
  end

  it "rejects bodies over 5 MB" do
    pack = build_pack
    pack["files"]["kaze.cns"] = "x" * (described_class::MAX_BYTES + 1)

    expect(errors_for(pack)).to include(/exceeds/)
  end
end

RSpec.describe Characters::DefParser do
  it "parses sections case-insensitively, ignoring comments and quotes" do
    parsed = described_class.parse("﻿[Info]\nName = \"Kaze\" ; nome\n\n[FILES]\nCMD=kaze.cmd\n; st = nope\n")

    expect(parsed).to eq("info" => { "name" => "Kaze" }, "files" => { "cmd" => "kaze.cmd" })
  end
end
